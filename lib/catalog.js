const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const positive = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
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
        });
    }
    if (!models.size)
        throw new Error('CodeBuddy catalog contains no chat models');
    return [...models.values()];
}
/** Cache the last successful catalog; a failed refresh never empties the selector. */
export class ModelCatalog {
    manual;
    connection;
    changed;
    remote = [];
    pending;
    controller = new AbortController();
    generation = 0;
    disposed = false;
    constructor(manual, connection, changed = () => { }) {
        this.manual = manual;
        this.connection = connection;
        this.changed = changed;
    }
    models() {
        const models = new Map(this.remote.map(model => [model.id, model]));
        for (const model of this.manual) {
            const overrides = Object.fromEntries(Object.entries(model).filter(([, value]) => value !== undefined));
            models.set(model.id, { ...models.get(model.id), ...overrides });
        }
        // Keep explicit choices, including Auto, ahead of the discovered models.
        return [...this.manual.map(model => models.get(model.id)), ...[...models.values()].filter(model => !this.manual.some(item => item.id === model.id))];
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