import z from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
export interface ModelConfig {
    id: string;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
    reasoningEfforts?: string[];
}
export interface Options {
    environment: 'internal' | 'overseas' | 'ioa';
    baseURL: string;
    apiKeyEnv: string;
    timeoutMs: number;
    includeUsage: boolean;
    models: ModelConfig[];
}
export type PluginConfig = Omit<Options, 'apiKeyEnv'> & {
    apiKeyEnv: Volatile<string>;
};
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
    baseURL: z<string, string, "defined">;
    apiKeyEnv: z<string, string, "volatile-defined">;
    timeoutMs: z<number, number, "defined">;
    includeUsage: z<boolean, boolean, "defined">;
    models: z<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
        reasoningEfforts?: string[] | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
        id: z<string, string, "defined">;
        name: z<string, string, "plain">;
        contextWindow: z<number, number, "plain">;
        maxTokens: z<number, number, "plain">;
        reasoningEfforts: z<string[], string[], "plain">;
    }>>[], "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
    baseURL: z<string, string, "defined">;
    apiKeyEnv: z<string, string, "volatile-defined">;
    timeoutMs: z<number, number, "defined">;
    includeUsage: z<boolean, boolean, "defined">;
    models: z<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
        reasoningEfforts?: string[] | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
        id: z<string, string, "defined">;
        name: z<string, string, "plain">;
        contextWindow: z<number, number, "plain">;
        maxTokens: z<number, number, "plain">;
        reasoningEfforts: z<string[], string[], "plain">;
    }>>[], "defined">;
}>>, "plain">;
export type ReadEnvironment = (name: string) => string | undefined;
/** Custom URL wins over region, matching Codeg's self-hosted selection. */
export declare function resolveBaseURL(config: Options, read: ReadEnvironment): string;
export declare function validateModels(models: ModelConfig[]): void;
