import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BASE_URL } from './config.js';
import { object } from './session.js';
export function parseCatalog(value) {
    const entries = object(value).models;
    if (!Array.isArray(entries))
        throw new Error('Codex model catalog missing');
    const models = new Map();
    for (const entry of entries) {
        const raw = object(entry);
        if (typeof raw.slug !== 'string' || !raw.slug.trim() || raw.visibility === 'hide' || raw.visibility === 'hidden'
            || raw.hidden === true || raw.disabled === true)
            continue;
        const efforts = Array.isArray(raw.supported_reasoning_levels)
            ? raw.supported_reasoning_levels.map(item => object(item).effort).filter((item) => typeof item === 'string' && !!item)
            : [];
        const capacity = raw.context_window;
        const percent = raw.effective_context_window_percent;
        const contextWindow = typeof capacity === 'number' && Number.isSafeInteger(capacity) && capacity > 0
            ? Math.floor(capacity * (typeof percent === 'number' && percent > 0 && percent <= 100 ? percent / 100 : 1)) : undefined;
        models.set(raw.slug, {
            id: raw.slug, name: typeof raw.display_name === 'string' && raw.display_name ? raw.display_name : raw.slug,
            inputModalities: Array.isArray(raw.input_modalities) && !raw.input_modalities.includes('image') ? ['text'] : ['text', 'image'],
            ...(contextWindow ? { contextWindow } : {}), reasoningEfforts: [...new Set(efforts)],
            ...(typeof raw.default_reasoning_level === 'string' && efforts.includes(raw.default_reasoning_level)
                ? { defaultReasoningEffort: raw.default_reasoning_level } : {}),
        });
    }
    if (!models.size)
        throw new Error('Codex catalog contains no visible models');
    return [...models.values()];
}
/** No guessed model IDs: load Codex's own cache, then try the account's live catalog once. */
export class CodexCatalog {
    session;
    changed;
    connection;
    entries = [];
    pending;
    controller = new AbortController();
    disposed = false;
    source;
    issue;
    constructor(session, changed = () => { }, connection = {}) {
        this.session = session;
        this.changed = changed;
        this.connection = connection;
    }
    models() { return this.entries; }
    ready() { return this.pending ?? Promise.resolve(); }
    refresh() {
        if (this.disposed)
            return Promise.resolve();
        if (this.pending)
            return this.pending;
        this.pending = this.load().finally(() => { this.pending = undefined; });
        return this.pending;
    }
    async load() {
        let version = '0.165.0';
        let cache;
        try {
            cache = JSON.parse(await readFile(join(this.session.home, 'models_cache.json'), 'utf8'));
            const cachedVersion = object(cache).client_version;
            if (typeof cachedVersion === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(cachedVersion))
                version = cachedVersion;
            if (this.source !== 'live' && !this.disposed) {
                this.entries = parseCatalog(cache);
                this.source = 'cache';
            }
        }
        catch { /* The live directory can work without a local model cache. */ }
        try {
            const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(15000)]);
            const auth = await this.session.authenticate(signal);
            const response = await (this.connection.fetch ?? fetch)(`${this.connection.baseURL ?? BASE_URL}/models?client_version=${encodeURIComponent(version)}`, {
                signal, headers: { Authorization: `Bearer ${auth.apiKey}`, ...auth.headers, originator: 'dsh_provider' },
            });
            if (!response.ok) {
                await response.body?.cancel();
                throw new Error('Catalog refused');
            }
            const models = parseCatalog(await response.json());
            if (this.disposed)
                return;
            this.entries = models;
            this.source = 'live';
            this.issue = undefined;
        }
        catch {
            if (!this.disposed)
                this.issue = this.entries.length ? '模型目录更新失败，正在使用已有目录。' : '未获取到模型目录，请确认本机 Codex 已登录后刷新。';
        }
        finally {
            if (!this.disposed)
                this.changed();
        }
    }
    dispose() { this.disposed = true; this.controller.abort(); }
}
//# sourceMappingURL=catalog.js.map