import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { LlmError, assertUsableApiKey } from '@deepseek-ai/dsh-llm';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { CodeBuddyAdapter } from './adapter.js';
import { ModelCatalog } from './catalog.js';
import { resolveBaseURL, validateModels } from './config.js';
import { API_KEY_REF } from './credential.js';
export { Config } from './config.js';
export const name = 'llm-codebuddy-provider';
export const inject = ['llm'];
export function apply(ctx, config) {
    validateModels(config.models);
    const environment = launchEnvironmentOf(ctx);
    const ref = credentialRef(API_KEY_REF);
    const baseURL = resolveBaseURL(config, key => environment.get(key)?.value);
    const connection = {
        baseURL,
        resolveApiKey: async () => {
            const credential = await ctx.get('credentials')?.resolve(ref);
            // Re-read saved keys per request, without accepting process or .env sources.
            const raw = credential?.source === 'file' ? credential.value : undefined;
            if (!raw?.trim())
                throw new LlmError('CodeBuddy: save an API key in Settings → Models → CodeBuddy API.', 'MISSING_CREDENTIAL');
            return assertUsableApiKey(raw, 'dsh-codebuddy-provider', ref);
        },
    };
    const catalog = config.autoUpdateModels ? new ModelCatalog(config.models, connection, () => {
        ctx.emit('llm/adapters-updated');
    }) : undefined;
    const adapter = new CodeBuddyAdapter(structuredClone(config), { ...connection, catalog });
    ctx.llm.registerAdapter(['codebuddy-api'], adapter);
    if (catalog) {
        // Credentials can start after the LLM route during DSH profile boot.
        ctx.inject(['credentials'], () => { void catalog.refresh(); });
        ctx.on('credentials/reference-updated', updated => {
            if (updated === ref)
                catalog.credentialsChanged();
        });
        ctx.effect(() => () => catalog.dispose());
    }
}
//# sourceMappingURL=index.js.map