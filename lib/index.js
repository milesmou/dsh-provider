import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { LlmError, assertUsableApiKey } from '@deepseek-ai/dsh-llm';
import { CodeBuddyAdapter } from './adapter.js';
import { resolveBaseURL, validateModels } from './config.js';
export { Config } from './config.js';
export const name = 'llm-codebuddy-provider';
export const inject = ['llm'];
export function apply(ctx, config) {
    validateModels(config.models);
    const environment = launchEnvironmentOf(ctx);
    const baseURL = resolveBaseURL(config, key => environment.get(key)?.value);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.apiKeyEnv))
        throw new Error('CodeBuddy: invalid apiKeyEnv name.');
    const adapter = new CodeBuddyAdapter(structuredClone(config), {
        baseURL,
        resolveApiKey: async () => {
            // Same credential reference as Codeg; no key is stored in plugin YAML.
            const raw = environment.get(config.apiKeyEnv)?.value;
            if (!raw?.trim())
                throw new LlmError(`CodeBuddy: set ${config.apiKeyEnv} before starting dsh.`, 'MISSING_CREDENTIAL');
            return assertUsableApiKey(raw, 'dsh-codebuddy-provider', config.apiKeyEnv);
        },
    });
    ctx.llm.registerAdapter(['codebuddy-api'], adapter);
}
//# sourceMappingURL=index.js.map