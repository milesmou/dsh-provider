import z from '@deepseek-ai/schemastery';
/** Fallback working window when the catalog does not disclose a model's capacity. */
export const DEFAULT_CONTEXT_WINDOW = 500 * 1024;
/**
 * Resolve the effective context window for a model.
 * `max` uses the model's disclosed capacity (500K when unknown); the fixed
 * choices are absolute caps. In every case the model's own maximum wins when it
 * is smaller, so a request can never exceed what the model actually accepts.
 */
export function resolveContextWindow(mode, modelMax) {
    const base = mode === '300k' ? 300 * 1024
        : mode === '500k' ? 500 * 1024
            : modelMax && modelMax > 0 ? modelMax : DEFAULT_CONTEXT_WINDOW;
    return modelMax && modelMax > 0 ? Math.min(base, modelMax) : base;
}
export const Config = z.object({
    mode: z.union(['api', 'workbuddy']).default('api').volatile(),
    workbuddyRegion: z.union(['cn', 'intl']).default('cn').volatile(),
    contextWindow: z.union(['300k', '500k', 'max']).default('max').volatile(),
    environment: z.union(['internal', 'overseas', 'ioa']).default('internal'),
    baseURL: z.string().default(''),
    timeoutMs: z.number().step(1).min(1).max(2147483647).default(180000),
    includeUsage: z.boolean().default(true),
});
/**
 * The built-in model shown before the catalog's first load, and the fallback
 * when discovery never succeeds. It is not user-configurable: the catalog is
 * the single source of truth for the model list.
 */
export function baselineModels(mode, region) {
    if (mode === 'workbuddy') {
        return region === 'intl'
            ? [{ id: 'default-model', name: 'WorkBuddy Auto' }]
            : [{ id: 'auto', name: 'WorkBuddy Auto' }];
    }
    return [{ id: 'auto', name: 'CodeBuddy Auto' }];
}
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
//# sourceMappingURL=config.js.map