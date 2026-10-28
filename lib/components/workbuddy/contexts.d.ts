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
/** A positive whole number of tokens, or undefined for "use the model default". */
export declare function normalizeContextWindow(value: unknown): number | undefined;
/** One short label for a token count, e.g. 204800 → "200K", 1048576 → "1M". */
export declare function formatContextWindow(tokens: number | undefined): string;
/**
 * Model-id → context-window (tokens) map. When a backing file is supplied the
 * overrides are loaded on construction and written back on change.
 */
export declare class ContextWindowStore {
    private readonly filename?;
    private readonly byModel;
    private saveTimer?;
    constructor(filename?: string | undefined);
    /** The override for one model, or undefined when the model default applies. */
    get(modelId: string): number | undefined;
    /** Every override, safe to hand to a Remote reply. */
    all(): Record<string, number>;
    /** Set (or clear, when tokens is undefined) one model's override. */
    set(modelId: string, tokens: number | undefined): void;
    /** Flush any pending write immediately (used on disposal and by tests). */
    persist(): Promise<void>;
    private restore;
    private scheduleSave;
    private write;
}
