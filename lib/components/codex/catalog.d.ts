import type { CodexSession } from './session.js';
export interface CodexModel {
    id: string;
    name: string;
    inputModalities: ('text' | 'image')[];
    contextWindow?: number;
    reasoningEfforts: string[];
    defaultReasoningEffort?: string;
}
export declare function parseCatalog(value: unknown): CodexModel[];
/** No guessed model IDs: load Codex's own cache, then try the account's live catalog once. */
export declare class CodexCatalog {
    private readonly session;
    private readonly changed;
    private readonly connection;
    private entries;
    private pending?;
    private controller;
    private disposed;
    source?: 'cache' | 'live';
    issue?: string;
    constructor(session: CodexSession, changed?: () => void, connection?: {
        baseURL?: string;
        fetch?: typeof fetch;
    });
    models(): readonly CodexModel[];
    ready(): Promise<void>;
    refresh(): Promise<void>;
    private load;
    dispose(): void;
}
