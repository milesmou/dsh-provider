import type { ModelConfig } from './config.js';
interface CatalogConnection {
    baseURL: string;
    resolveApiKey?(): Promise<string>;
    authenticate?(signal?: AbortSignal): Promise<{
        apiKey: string;
        headers: Record<string, string>;
    }>;
    catalogURL?: string;
    fetch?: typeof fetch;
}
/** The official CLI uses /v3/config; custom OpenAI gateways use /models. */
export declare function catalogURL(baseURL: string): string;
export declare function parseCatalog(value: unknown): ModelConfig[];
/** Cache the last successful catalog; a failed refresh never empties the selector. */
export declare class ModelCatalog {
    private readonly baseline;
    private readonly connection;
    private readonly changed;
    /** Per-model context-window overrides from the component settings. */
    private readonly contextOverrides;
    private remote;
    private pending?;
    private controller;
    private generation;
    private disposed;
    constructor(baseline: ModelConfig[], connection: CatalogConnection, changed?: () => void, 
    /** Per-model context-window overrides from the component settings. */
    contextOverrides?: () => Record<string, number>);
    /** Models as the adapter should route them: catalog + baseline + user overrides. */
    models(): ModelConfig[];
    /** Models exactly as discovered/baseline, without context-window overrides (for settings UI). */
    baseModels(): ModelConfig[];
    private assemble;
    refresh(): Promise<void>;
    /** Wait for startup/key-save discovery; opening the selector performs no I/O. */
    ready(): Promise<void>;
    credentialsChanged(): void;
    dispose(): void;
}
export {};
