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
/** Both official regions discover their model catalog at /v3/config. */
export declare function catalogURL(baseURL: string): string;
export declare function parseCatalog(value: unknown): ModelConfig[];
/** Cache the last successful catalog; a failed refresh never empties the selector. */
export declare class ModelCatalog {
    private readonly baseline;
    private readonly connection;
    private readonly changed;
    /** Which context window the adapter should advertise (settings choice). */
    private readonly contextPolicy;
    issue?: string;
    private remote;
    private pending?;
    private controller;
    private generation;
    private disposed;
    constructor(baseline: ModelConfig[], connection: CatalogConnection, changed?: () => void, 
    /** Which context window the adapter should advertise (settings choice). */
    contextPolicy?: () => ContextWindowMode);
    /**
     * Models as the adapter routes them. The settings choice is a light/middle/max
     * tier that maps to each model's own disclosed lengths, so a request never
     * exceeds what that model actually accepts.
     */
    models(): ModelConfig[];
    refresh(): Promise<void>;
    /** Wait for startup/key-save discovery; opening the selector performs no I/O. */
    ready(): Promise<void>;
    credentialsChanged(): void;
    dispose(): void;
}
export {};
