import z from '@deepseek-ai/schemastery';
export const Config = z.object({
    environment: z.union(['internal', 'overseas', 'ioa']).default('internal'),
    baseURL: z.string().default(''),
    apiKeyEnv: z.string().role('credential-ref').default('CODEBUDDY_API_KEY').volatile(),
    timeoutMs: z.number().step(1).min(1).max(2147483647).default(180000),
    includeUsage: z.boolean().default(true),
    models: z.array(z.object({
        id: z.string().required(),
        name: z.string(),
        contextWindow: z.number().step(1).min(1),
        maxTokens: z.number().step(1).min(1),
        reasoningEfforts: z.array(z.string()),
    })).default([{ id: 'auto', name: 'CodeBuddy Auto' }]),
});
/** Custom URL wins over region, matching Codeg's self-hosted selection. */
export function resolveBaseURL(config, read) {
    const custom = config.baseURL.trim() || read('CODEBUDDY_BASE_URL')?.trim();
    const region = read('CODEBUDDY_INTERNET_ENVIRONMENT')?.trim() || config.environment;
    if (!custom && !['internal', 'overseas'].includes(region)) {
        throw new Error('CodeBuddy: iOA requires an explicit baseURL or CODEBUDDY_BASE_URL.');
    }
    const value = custom || (region === 'internal'
        ? 'https://copilot.tencent.com/v2'
        : 'https://www.codebuddy.ai/v2');
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('CodeBuddy: baseURL must be an HTTP(S) URL without credentials, query or fragment.');
    }
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '') || '/v2';
    return url.toString().replace(/\/+$/, '');
}
export function validateModels(models) {
    if (!models.length)
        throw new Error('CodeBuddy: configure at least one model ID.');
    const ids = new Set();
    const supportedEfforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
    for (const model of models) {
        if (!model.id.trim() || model.id !== model.id.trim() || ids.has(model.id)) {
            throw new Error('CodeBuddy: model IDs must be unique, nonempty and have no surrounding whitespace.');
        }
        if (model.contextWindow && model.maxTokens && model.maxTokens > model.contextWindow) {
            throw new Error(`CodeBuddy: maxTokens exceeds contextWindow for ${model.id}.`);
        }
        if (new Set(model.reasoningEfforts).size !== (model.reasoningEfforts?.length ?? 0)
            || model.reasoningEfforts?.some(effort => !supportedEfforts.has(effort))) {
            throw new Error(`CodeBuddy: invalid reasoningEfforts for ${model.id}.`);
        }
        ids.add(model.id);
    }
}
//# sourceMappingURL=config.js.map