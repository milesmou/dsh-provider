import z from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
import type { WorkBuddyRegion } from './session.js';
export type Mode = 'api' | 'workbuddy';
/** Which context-window tier the adapter advertises to DSH: the model's own light / middle / max length. */
export type ContextWindowMode = 'light' | 'middle' | 'max';
export type PluginConfig = Options & {
    mode: Volatile<Mode>;
    workbuddyRegion: Volatile<WorkBuddyRegion>;
    contextWindow: Volatile<ContextWindowMode>;
    hiddenModels: Volatile<string[]>;
};
/** Fallback working window when the catalog discloses no context length at all. */
export declare const DEFAULT_CONTEXT_WINDOW: number;
/**
 * Ascending distinct context lengths a model's catalog entry disclosed (light → max).
 * The model's maximum capacity is always included when known, so `max` can never
 * exceed what the model advertises.
 */
export declare function contextTiers(model: Pick<ModelConfig, 'contextWindow' | 'contextLengths'>): number[];
/**
 * Resolve the effective context window from the selected tier against the model's
 * own disclosed lengths: `light` is the smallest, `middle` the median, and `max`
 * the largest. A model that discloses no length falls back to the default window.
 */
export declare function resolveContextWindow(mode: ContextWindowMode, model: Pick<ModelConfig, 'contextWindow' | 'contextLengths'>): number;
/**
 * One model entry. Always produced by the catalog now; the fields beyond
 * identity are whatever the catalog disclosed (capacity, image support, and
 * thinking levels). The baseline entry below carries only identity.
 */
export interface ModelConfig {
    id: string;
    name?: string;
    contextWindow?: number;
    /** Ascending context lengths the catalog disclosed for tier selection (light → max). */
    contextLengths?: number[];
    maxTokens?: number;
    /** Accepted input modalities, when the catalog discloses them; absent means text-only default. */
    supportsImages?: boolean;
    /** Selectable thinking levels (lowest to highest), from the catalog's reasoning metadata. */
    reasoningEfforts?: string[];
    /** Adapter-configured default thinking level materialized when the caller omits one. */
    defaultReasoningEffort?: string;
    /** Whether reasoning can be disabled entirely (adds the `none` level). */
    canDisableThinking?: boolean;
    /** Credit multiplier the catalog advertises (e.g. `x0.69`), when disclosed. */
    credits?: string;
}
export interface Options {
    environment: 'internal' | 'overseas' | 'ioa';
    baseURL: string;
    timeoutMs: number;
    includeUsage: boolean;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
    workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
    contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
    hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
    baseURL: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
    includeUsage: z<boolean, boolean, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
    workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
    contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
    hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
    baseURL: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
    includeUsage: z<boolean, boolean, "defined">;
}>>, "plain">;
/**
 * The built-in model shown before the catalog's first load, and the fallback
 * when discovery never succeeds. It is not user-configurable: the catalog is
 * the single source of truth for the model list.
 */
export declare function baselineModels(mode: Mode, region: WorkBuddyRegion): ModelConfig[];
export type ReadEnvironment = (name: string) => string | undefined;
/** Custom URL wins over region, matching Codeg's self-hosted selection. */
export declare function resolveBaseURL(config: Options, read: ReadEnvironment): string;
