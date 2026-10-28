import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { LlmError, assertUsableApiKey } from '@deepseek-ai/dsh-llm';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { CodeBuddyAdapter } from './adapter.js';
import { ModelCatalog } from './catalog.js';
import { resolveBaseURL, validateModels } from './config.js';
export { Config } from './config.js';
export const name = 'llm-codebuddy-provider';
export const inject = ['llm'];
export function apply(ctx, config) {
    validateModels(config.models);
    const environment = launchEnvironmentOf(ctx);
    const initialRef = credentialRef(config.apiKeyEnv.get());
    const options = { ...config, apiKeyEnv: initialRef };
    const baseURL = resolveBaseURL(options, key => environment.get(key)?.value);
    const connection = {
        baseURL,
        resolveApiKey: async () => {
            const ref = credentialRef(config.apiKeyEnv.get());
            const credentials = ctx.get('credentials');
            // Resolve on every request so the Models page can rotate a saved key
            // without restarting. The provider owns stored-key/environment priority.
            const raw = credentials === undefined
                ? environment.get(ref)?.value
                : (await credentials.resolve(ref))?.value;
            if (!raw?.trim())
                throw new LlmError('CodeBuddy: save an API key in Settings → Models → CodeBuddy API, or set ' + ref + '.', 'MISSING_CREDENTIAL');
            return assertUsableApiKey(raw, 'dsh-codebuddy-provider', ref);
        },
    };
    const catalog = config.autoUpdateModels ? new ModelCatalog(config.models, config.modelRefreshIntervalMs, connection, () => {
        ctx.emit('llm/adapters-updated');
    }) : undefined;
    const adapter = new CodeBuddyAdapter(structuredClone(options), { ...connection, catalog });
    ctx.llm.registerAdapter(['codebuddy-api'], adapter);
    if (catalog) {
        // Credentials can start after the LLM route during DSH profile boot.
        ctx.inject(['credentials'], () => { catalog.credentialsChanged(); });
        ctx.on('credentials/reference-updated', ref => {
            if (ref === config.apiKeyEnv.get())
                catalog.credentialsChanged();
        });
        ctx.effect(() => {
            void catalog.refresh();
            const timer = setInterval(() => { void catalog.refresh(); }, Math.min(config.modelRefreshIntervalMs, 60000));
            timer.unref();
            return () => { clearInterval(timer); catalog.dispose(); };
        });
    }
    ctx.inject(['settings'], child => {
        child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
    });
}
//# sourceMappingURL=index.js.map