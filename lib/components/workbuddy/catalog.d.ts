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
    private remote;
    private pending?;
    private controller;
    private generation;
    private disposed;
    constructor(baseline: ModelConfig[], connection: CatalogConnection, changed?: () => void);
    /**
     * Models as the adapter routes them. Every entry runs with a 500K working
     * window, except a model whose catalog maximum is smaller — that smaller
     * maximum wins so a request never exceeds the model's real capacity.
     */
    models(): ModelConfig[];
    refresh(): Promise<void>;
    /** Wait for startup/key-save discovery; opening the selector performs no I/O. */
    ready(): Promise<void>;
    credentialsChanged(): void;
    dispose(): void;
}
export {};
