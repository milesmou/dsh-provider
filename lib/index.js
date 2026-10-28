import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { LlmAdapter, LlmError, assertUsableApiKey } from '@deepseek-ai/dsh-llm';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { CodeBuddyAdapter } from './adapter.js';
import { ModelCatalog } from './catalog.js';
import { resolveBaseURL, validateModels } from './config.js';
import { API_KEY_REF } from './credential.js';
import { WorkBuddySession, SITES } from './workbuddy.js';
import { ProviderController } from './controller.js';
export { Config } from './config.js';
export const name = 'llm-codebuddy-provider';
export const inject = ['llm'];
/** Hold one adapter generation for an entire prepared call. */
class SwitchingAdapter extends LlmAdapter {
    current;
    constructor(current) {
        super();
        this.current = current;
    }
    providerInfo(provider) { return this.current().providerInfo(provider); }
    listModels(provider) { return this.current().listModels(provider); }
    resolveModel(provider, model) { return this.current().resolveModel(provider, model); }
    prepareCall(provider, model, signal) { return this.current().prepareCall(provider, model, signal); }
    stream(options) { return this.current().stream(options); }
}
export function apply(ctx, config) {
    validateModels(config.models);
    const { mode, workbuddyRegion, ...options } = config;
    const environment = launchEnvironmentOf(ctx);
    const ref = credentialRef(API_KEY_REF);
    const sessions = new Map();
    let catalog;
    let adapter;
    let selection = '';
    const session = () => {
        const region = workbuddyRegion.get();
        let found = sessions.get(region);
        if (!found) {
            found = new WorkBuddySession(region, () => ctx.get('credentials'), () => {
                if (mode.get() === 'workbuddy' && workbuddyRegion.get() === region)
                    catalog?.credentialsChanged();
            });
            sessions.set(region, found);
        }
        return found;
    };
    function rebuild() {
        for (const value of sessions.values())
            value.cancelLogin();
        catalog?.dispose();
        selection = mode.get() + ':' + workbuddyRegion.get();
        let connection;
        if (mode.get() === 'workbuddy') {
            const login = session();
            const site = SITES[login.region];
            connection = { baseURL: site.endpoint + '/v2', catalogURL: site.endpoint + '/v3/config',
                authenticate: signal => login.authenticate(signal), workbuddy: true,
                providerName: login.region === 'cn' ? 'WorkBuddy' : 'WorkBuddy AI',
            };
        }
        else {
            connection = {
                baseURL: resolveBaseURL(options, key => environment.get(key)?.value),
                resolveApiKey: async () => {
                    const credential = await ctx.get('credentials')?.resolve(ref);
                    const raw = credential?.source === 'file' ? credential.value : undefined;
                    if (!raw?.trim())
                        throw new LlmError('CodeBuddy: save an API key in Settings → Models → CodeBuddy API.', 'MISSING_CREDENTIAL');
                    return assertUsableApiKey(raw, 'dsh-codebuddy-provider', ref);
                },
            };
        }
        const models = mode.get() === 'workbuddy' && config.models.length === 1 && config.models[0].id === 'auto' && config.models[0].name === 'CodeBuddy Auto'
            ? [{ id: workbuddyRegion.get() === 'cn' ? 'auto' : 'default-model', name: 'WorkBuddy Auto' }]
            : config.models;
        catalog = config.autoUpdateModels ? new ModelCatalog(models, connection, () => ctx.emit('llm/adapters-updated')) : undefined;
        adapter = new CodeBuddyAdapter(structuredClone({ ...options, models }), { ...connection, catalog });
        void catalog?.refresh();
    }
    rebuild();
    ctx.llm.registerAdapter(['codebuddy-api'], new SwitchingAdapter(() => adapter));
    ctx.plugin(ProviderController, { session, enabled: () => mode.get() === 'workbuddy' });
    ctx.inject(['credentials'], () => { catalog?.credentialsChanged(); });
    ctx.on('credentials/reference-updated', updated => {
        if (updated === ref && mode.get() === 'api')
            catalog?.credentialsChanged();
    });
    ctx.on('settings/document-updated', ns => {
        if (ns === name && selection !== mode.get() + ':' + workbuddyRegion.get()) {
            rebuild();
            ctx.emit('llm/adapters-updated');
        }
    });
    ctx.inject(['settings'], child => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)); });
    ctx.effect(() => () => { catalog?.dispose(); for (const value of sessions.values())
        value.dispose(); });
}
//# sourceMappingURL=index.js.map