import type { ModelConfig } from './config.js';
interface CatalogConnection {
    baseURL: string;
    resolveApiKey(): Promise<string>;
    fetch?: typeof fetch;
}
/** The official CLI uses /v3/config; custom OpenAI gateways use /models. */
export declare function catalogURL(baseURL: string): string;
export declare function parseCatalog(value: unknown): ModelConfig[];
/** Cache the last successful catalog; a failed refresh never empties the selector. */
export declare class ModelCatalog {
    private readonly manual;
    private readonly connection;
    private readonly changed;
    private remote;
    private pending?;
    private controller;
    private generation;
    private disposed;
    constructor(manual: ModelConfig[], connection: CatalogConnection, changed?: () => void);
    models(): ModelConfig[];
    refresh(): Promise<void>;
    /** Wait for startup/key-save discovery; opening the selector performs no I/O. */
    ready(): Promise<void>;
    credentialsChanged(): void;
    dispose(): void;
}
export {};
