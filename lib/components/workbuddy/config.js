import z from '@deepseek-ai/schemastery';
/** Fallback working window when the catalog discloses no context length at all. */
export const DEFAULT_CONTEXT_WINDOW = 500 * 1024;
/**
 * Ascending distinct context lengths a model's catalog entry disclosed (light → max).
 * The model's maximum capacity is always included when known, so `max` can never
 * exceed what the model advertises.
 */
export function contextTiers(model) {
    const lengths = new Set();
    for (const value of model.contextLengths ?? []) {
        if (Number.isSafeInteger(value) && value > 0)
            lengths.add(value);
    }
    const capacity = model.contextWindow;
    if (typeof capacity === 'number' && Number.isSafeInteger(capacity) && capacity > 0)
        lengths.add(capacity);
    return [...lengths].sort((a, b) => a - b);
}
/**
 * Resolve the effective context window from the selected tier against the model's
 * own disclosed lengths: `light` is the smallest, `middle` the median, and `max`
 * the largest. A model that discloses no length falls back to the default window.
 */
export function resolveContextWindow(mode, model) {
    const lengths = contextTiers(model);
    if (!lengths.length)
        return DEFAULT_CONTEXT_WINDOW;
    if (mode === 'light')
        return lengths[0];
    if (mode === 'middle')
        return lengths[Math.min(lengths.length - 1, Math.floor(lengths.length / 2))];
    return lengths[lengths.length - 1];
}
export const Config = z.object({
    mode: z.union(['api', 'workbuddy']).default('api').volatile(),
    workbuddyRegion: z.union(['cn', 'intl']).default('cn').volatile(),
    contextWindow: z.union(['light', 'middle', 'max']).default('max').volatile(),
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