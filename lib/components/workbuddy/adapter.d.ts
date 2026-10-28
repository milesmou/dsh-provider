import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { Options } from './config.js';
import type { ModelCatalog } from './catalog.js';
export interface Connection {
    baseURL: string;
    resolveApiKey?: () => Promise<string>;
    authenticate?: (signal?: AbortSignal) => Promise<{
        apiKey: string;
        headers: Record<string, string>;
    }>;
    workbuddy?: boolean;
    providerName?: string;
    fetch?: typeof fetch;
    catalog?: ModelCatalog;
}
export declare class CodeBuddyAdapter extends LlmAdapter {
    private readonly config;
    private readonly connection;
    /** System prompts WorkBuddy refused as an unapproved channel this run. */
    private readonly refusedSystems;
    /** Models that refused tool results followed by the user's message this run. */
    private readonly endsAfterTools;
    constructor(config: Options, connection: Connection);
    providerInfo(provider: string): {
        id: string;
        name: string;
    };
    listModels(provider: string): Promise<{
        provider: string;
        id: string;
        name: string;
        inputModalities: "text"[];
    }[]>;
    private modelConfig;
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
