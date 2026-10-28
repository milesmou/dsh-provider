/**
 * Per-model context-window overrides chosen in the WorkBuddy component settings.
 *
 * WorkBuddy's own app lets a model run with a smaller working window than its
 * declared maximum (default 200K, up to 1M); a smaller window sends less history
 * per turn, so compaction kicks in earlier and each round costs fewer credits.
 * The override is stored per model id and reported as the adapter's
 * `context.contextWindow`, which is exactly the figure DSH's token meter and
 * compaction use to size the request budget.
 */
import { readFileSync } from 'node:fs';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
/** A positive whole number of tokens, or undefined for "use the model default". */
export function normalizeContextWindow(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
/** One short label for a token count, e.g. 204800 → "200K", 1048576 → "1M". */
export function formatContextWindow(tokens) {
    if (tokens === undefined)
        return '未知';
    if (tokens >= 1024 * 1024 && tokens % (1024 * 1024) === 0)
        return `${tokens / (1024 * 1024)}M`;
    if (tokens >= 1024 && tokens % 1024 === 0)
        return `${tokens / 1024}K`;
    return String(tokens);
}
/**
 * Model-id → context-window (tokens) map. When a backing file is supplied the
 * overrides are loaded on construction and written back on change.
 */
export class ContextWindowStore {
    filename;
    byModel = new Map();
    saveTimer;
    constructor(filename) {
        this.filename = filename;
        if (filename)
            this.restore();
    }
    /** The override for one model, or undefined when the model default applies. */
    get(modelId) {
        return this.byModel.get(maxKey(modelId));
    }
    /** Every override, safe to hand to a Remote reply. */
    all() {
        return Object.fromEntries(this.byModel);
    }
    /** Set (or clear, when tokens is undefined) one model's override. */
    set(modelId, tokens) {
        const key = maxKey(modelId);
        const value = normalizeContextWindow(tokens);
        if (value === undefined)
            this.byModel.delete(key);
        else
            this.byModel.set(key, value);
        this.scheduleSave();
    }
    /** Flush any pending write immediately (used on disposal and by tests). */
    async persist() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = undefined;
        }
        await this.write();
    }
    restore() {
        if (!this.filename)
            return;
        try {
            const data = JSON.parse(readFileSync(this.filename, 'utf8'));
            if (!data || typeof data !== 'object')
                return;
            for (const [key, value] of Object.entries(data)) {
                const tokens = normalizeContextWindow(value);
                if (key && tokens !== undefined)
                    this.byModel.set(key, tokens);
            }
        }
        catch {
            // Missing or corrupt settings: start with every model on its default.
        }
    }
    scheduleSave() {
        if (!this.filename || this.saveTimer)
            return;
        this.saveTimer = setTimeout(() => { this.saveTimer = undefined; void this.write(); }, 100);
        this.saveTimer.unref?.();
    }
    async write() {
        if (!this.filename)
            return;
        try {
            await writeFileAtomic(this.filename, JSON.stringify(this.all(), null, 2), { mode: 0o600, dirMode: 0o700 });
        }
        catch {
            // A failed settings write must not fail the settings interaction.
        }
    }
}
function maxKey(modelId) {
    return String(modelId);
}
//# sourceMappingURL=contexts.js.map