import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, ImageBlock, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { Options } from './config.js';
import type { CodexAuth } from './session.js';
import type { CodexCatalog } from './catalog.js';
export interface Connection {
    authenticate(signal?: AbortSignal): Promise<CodexAuth>;
    catalog: Pick<CodexCatalog, 'ready' | 'models'>;
    resolveImage?(ref: ImageBlock['attachment'], signal?: AbortSignal): Promise<string>;
    baseURL?: string;
    fetch?: typeof fetch;
    hiddenModels?(): readonly string[];
}
export declare class CodexAdapter extends LlmAdapter {
    private readonly config;
    private readonly connection;
    constructor(config: Options, connection: Connection);
    providerInfo(provider: string): {
        id: string;
        name: string;
    };
    listModels(provider: string): Promise<{
        provider: string;
        id: string;
        name: string;
        inputModalities: ("text" | "image")[];
    }[]>;
    resolveModel(provider: string, id: string): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
