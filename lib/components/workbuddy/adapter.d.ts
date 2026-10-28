import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, ImageBlock, LlmResolvedModelInfo, ModelModality, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { ModelConfig, Options } from './config.js';
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
    /**
     * Resolve one durable image reference to a base64 data URL the provider
     * accepts. Backed by the attachment service; absent means images degrade to
     * the framework's text-only placeholder.
     */
    resolveImage?: (ref: ImageBlock['attachment'], signal?: AbortSignal) => Promise<string>;
    /**
     * Report one request's exact credit charge (from the completion's `usage`)
     * to the session ledger. Absent when the deployment does not surface credits.
     */
    recordCredit?: (sessionId: string | undefined, credit: number) => void;
    fetch?: typeof fetch;
    catalog?: ModelCatalog;
    /** Built-in model shown before/without a catalog result; never user-configured. */
    fallback?: ModelConfig[];
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
        inputModalities: readonly ModelModality[];
        description?: string | undefined;
        provider: string;
        id: string;
        name: string;
    }[]>;
    /** Models to advertise: the live catalog when present, else the built-in baseline. */
    private modelList;
    private modelConfig;
    /**
     * Read every image occurrence of the request into a base64 data URL once, so
     * message building stays synchronous. An offloaded image, an unavailable
     * attachment service, or a read failure simply yields no entry for that
     * attachment id, and message building falls back to the text-only placeholder
     * for it rather than failing the request.
     */
    private resolveImages;
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
