import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { Options } from './config.js';
interface Connection {
    baseURL: string;
    resolveApiKey: () => Promise<string>;
    fetch?: typeof fetch;
}
export declare class CodeBuddyAdapter extends LlmAdapter {
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
        inputModalities: "text"[];
    }[]>;
    private modelConfig;
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
export {};
