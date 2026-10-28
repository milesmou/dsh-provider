import type { ContextWindowMode, ModelConfig } from './config.js';
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
    /** Which context window the adapter should advertise (settings choice). */
    private readonly contextPolicy;
    private remote;
    private pending?;
    private controller;
    private generation;
    private disposed;
    constructor(baseline: ModelConfig[], connection: CatalogConnection, changed?: () => void, 
    /** Which context window the adapter should advertise (settings choice). */
    contextPolicy?: () => ContextWindowMode);
    /**
     * Models as the adapter routes them. The settings choice sets a 300K/500K cap
     * or asks for each model's own maximum; a smaller model capacity always wins
     * so a request never exceeds the model's real capacity.
     */
    models(): ModelConfig[];
    refresh(): Promise<void>;
    /** Wait for startup/key-save discovery; opening the selector performs no I/O. */
    ready(): Promise<void>;
    credentialsChanged(): void;
    dispose(): void;
}
export {};
