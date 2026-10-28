import { resolveContextWindow } from './config.js';
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const positive = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
const strings = (value) => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : [];
/**
 * Thinking levels one catalog entry advertises. WorkBuddy exposes either a
 * `supportedEfforts` ladder (low→max) or a single legacy `effort`, plus an
 * optional `canDisableThinking` that adds the `none` level. Absent means the
 * model declares no thinking control, so the caller offers none.
 */
function reasoningOf(raw) {
    if (raw.supportsReasoning === false)
        return {};
    const reasoning = object(raw.reasoning);
    const ladder = strings(reasoning.supportedEfforts);
    const single = typeof reasoning.effort === 'string' && reasoning.effort.trim() ? reasoning.effort.trim() : undefined;
    const efforts = ladder.length ? ladder : single ? [single] : [];
    if (!efforts.length)
        return {};
    const canDisable = reasoning.canDisableThinking === true || raw.canDisableThinking === true;
    const levels = canDisable ? ['none', ...efforts] : efforts;
    const configuredDefault = typeof reasoning.defaultEffort === 'string' && reasoning.defaultEffort.trim()
        ? reasoning.defaultEffort.trim() : single;
    const defaultEffort = configuredDefault && levels.includes(configuredDefault) ? configuredDefault
        : levels.includes('high') ? 'high' : levels[levels.length - 1];
    return { reasoningEfforts: levels, ...(defaultEffort ? { defaultReasoningEffort: defaultEffort } : {}),
        ...(canDisable ? { canDisableThinking: true } : {}) };
}
/** The official CLI uses /v3/config; custom OpenAI gateways use /models. */
export function catalogURL(baseURL) {
    const url = new URL(baseURL);
    return ['copilot.tencent.com', 'www.codebuddy.ai'].includes(url.hostname) && url.pathname === '/v2'
        ? new URL('/v3/config', url).href : baseURL + '/models';
}
export function parseCatalog(value) {
    const envelope = object(value);
    if (envelope.code !== undefined && envelope.code !== 0)
        throw new Error('CodeBuddy catalog refused');
    const data = object(envelope.data);
    const entries = Array.isArray(envelope.data) ? envelope.data : data.models ?? envelope.models;
    if (!Array.isArray(entries))
        throw new Error('CodeBuddy catalog missing models');
    const agents = data.agents ?? object(data.agent).agents;
    const cli = Array.isArray(agents) ? agents.map(object).find(agent => agent.name === 'cli') : undefined;
    const allowed = Array.isArray(cli?.models) && cli.models.length ? new Set(cli.models) : undefined;
    const models = new Map();
    for (const entry of entries) {
        const raw = object(entry);
        if (typeof raw.id !== 'string' || !raw.id.trim() || raw.id !== raw.id.trim()
            || raw.disabled === true || raw.supportsToolCall === false || (allowed && !allowed.has(raw.id))
            || (Array.isArray(raw.tags) && raw.tags.some(tag => ['text-to-image', 'image-to-image', 'text-to-video'].includes(String(tag)))))
            continue;
        const contextWindow = positive(raw.contextWindow ?? raw.maxAllowedSize ?? raw.maxInputTokens);
        const maxTokens = positive(raw.maxTokens ?? raw.maxOutputTokens);
        models.set(raw.id, {
            id: raw.id,
            ...(typeof raw.name === 'string' && raw.name.trim() ? { name: raw.name } : {}),
            ...(contextWindow ? { contextWindow } : {}),
            ...(maxTokens ? { maxTokens: contextWindow ? Math.min(contextWindow, maxTokens) : maxTokens } : {}),
            ...(typeof raw.supportsImages === 'boolean' ? { supportsImages: raw.supportsImages } : {}),
            ...reasoningOf(raw),
        });
    }
    if (!models.size)
        throw new Error('CodeBuddy catalog contains no chat models');
    return [...models.values()];
}
/** Cache the last successful catalog; a failed refresh never empties the selector. */
export class ModelCatalog {
    baseline;
    connection;
    changed;
    contextPolicy;
    remote = [];
    pending;
    controller = new AbortController();
    generation = 0;
    disposed = false;
    constructor(baseline, connection, changed = () => { }, 
    /** Which context window the adapter should advertise (settings choice). */
    contextPolicy = () => 'max') {
        this.baseline = baseline;
        this.connection = connection;
        this.changed = changed;
        this.contextPolicy = contextPolicy;
    }
    /**
     * Models as the adapter routes them. The settings choice sets a 300K/500K cap
     * or asks for each model's own maximum; a smaller model capacity always wins
     * so a request never exceeds the model's real capacity.
     */
    models() {
        const models = new Map(this.remote.map(model => [model.id, model]));
        for (const model of this.baseline) {
            const overrides = Object.fromEntries(Object.entries(model).filter(([, value]) => value !== undefined));
            models.set(model.id, { ...models.get(model.id), ...overrides });
        }
        const policy = this.contextPolicy();
        for (const [id, model] of models) {
            models.set(id, { ...model, contextWindow: resolveContextWindow(policy, model.contextWindow) });
        }
        // Keep the built-in baseline entry (Auto) ahead of the discovered models.
        return [...this.baseline.map(model => models.get(model.id)), ...[...models.values()].filter(model => !this.baseline.some(item => item.id === model.id))];
    }
    refresh() {
        if (this.disposed)
            return Promise.resolve();
        if (this.pending)
            return this.pending;
        const generation = this.generation;
        const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(10000)]);
        const task = (async () => {
            try {
                const auth = this.connection.authenticate ? await this.connection.authenticate(signal) : undefined;
                const apiKey = auth?.apiKey ?? await this.connection.resolveApiKey();
                signal.throwIfAborted();
                const response = await (this.connection.fetch ?? fetch)(this.connection.catalogURL ?? catalogURL(this.connection.baseURL), {
                    headers: { Accept: 'application/json', ...(auth?.headers ?? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey,
                            'User-Agent': 'CLI/2.177.0 CodeBuddy/2.177.0', 'X-Product': 'SaaS' }) },
                    signal, redirect: 'error',
                });
                if (!response.ok) {
                    await response.body?.cancel();
                    throw new Error('CodeBuddy catalog unavailable');
                }
                const models = parseCatalog(await response.json());
                if (this.disposed || generation !== this.generation)
                    return;
                if (JSON.stringify(models) !== JSON.stringify(this.remote)) {
                    this.remote = models;
                    this.changed();
                }
            }
            catch {
                // Never surface transport bodies/headers, which can echo the API key.
            }
        })();
        this.pending = task;
        void task.finally(() => { if (this.pending === task)
            this.pending = undefined; });
        return task;
    }
    /** Wait for startup/key-save discovery; opening the selector performs no I/O. */
    async ready() {
        while (this.pending && !this.disposed)
            await this.pending;
    }
    credentialsChanged() {
        if (this.disposed)
            return;
        this.generation++;
        this.controller.abort();
        this.controller = new AbortController();
        this.pending = undefined;
        const hadModels = this.remote.length > 0;
        this.remote = [];
        if (hadModels)
            this.changed();
        void this.refresh();
    }
    dispose() {
        this.disposed = true;
        this.controller.abort();
    }
}
//# sourceMappingURL=catalog.js.map