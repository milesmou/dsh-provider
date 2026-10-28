import z from '@deepseek-ai/schemastery';
import type { PluginConfig as WorkBuddyOptions } from './components/workbuddy/config.js';
export interface PluginConfig {
    workbuddy: WorkBuddyOptions;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    workbuddy: z<Schemastery.ObjectS<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
        autoUpdateModels: z<boolean, boolean, "defined">;
        models: z<({
            id?: string | null | undefined;
            name?: string | null | undefined;
            contextWindow?: number | null | undefined;
            maxTokens?: number | null | undefined;
            supportsImages?: boolean | null | undefined;
            reasoningEfforts?: string[] | null | undefined;
            defaultReasoningEffort?: string | null | undefined;
            canDisableThinking?: boolean | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            id: z<string, string, "defined">;
            name: z<string, string, "plain">;
            contextWindow: z<number, number, "plain">;
            maxTokens: z<number, number, "plain">;
            supportsImages: z<boolean, boolean, "plain">;
            reasoningEfforts: z<string[], string[], "plain">;
            defaultReasoningEffort: z<string, string, "plain">;
            canDisableThinking: z<boolean, boolean, "plain">;
        }>>[], "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
        autoUpdateModels: z<boolean, boolean, "defined">;
        models: z<({
            id?: string | null | undefined;
            name?: string | null | undefined;
            contextWindow?: number | null | undefined;
            maxTokens?: number | null | undefined;
            supportsImages?: boolean | null | undefined;
            reasoningEfforts?: string[] | null | undefined;
            defaultReasoningEffort?: string | null | undefined;
            canDisableThinking?: boolean | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            id: z<string, string, "defined">;
            name: z<string, string, "plain">;
            contextWindow: z<number, number, "plain">;
            maxTokens: z<number, number, "plain">;
            supportsImages: z<boolean, boolean, "plain">;
            reasoningEfforts: z<string[], string[], "plain">;
            defaultReasoningEffort: z<string, string, "plain">;
            canDisableThinking: z<boolean, boolean, "plain">;
        }>>[], "defined">;
    }>>, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    workbuddy: z<Schemastery.ObjectS<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
        autoUpdateModels: z<boolean, boolean, "defined">;
        models: z<({
            id?: string | null | undefined;
            name?: string | null | undefined;
            contextWindow?: number | null | undefined;
            maxTokens?: number | null | undefined;
            supportsImages?: boolean | null | undefined;
            reasoningEfforts?: string[] | null | undefined;
            defaultReasoningEffort?: string | null | undefined;
            canDisableThinking?: boolean | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            id: z<string, string, "defined">;
            name: z<string, string, "plain">;
            contextWindow: z<number, number, "plain">;
            maxTokens: z<number, number, "plain">;
            supportsImages: z<boolean, boolean, "plain">;
            reasoningEfforts: z<string[], string[], "plain">;
            defaultReasoningEffort: z<string, string, "plain">;
            canDisableThinking: z<boolean, boolean, "plain">;
        }>>[], "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
        autoUpdateModels: z<boolean, boolean, "defined">;
        models: z<({
            id?: string | null | undefined;
            name?: string | null | undefined;
            contextWindow?: number | null | undefined;
            maxTokens?: number | null | undefined;
            supportsImages?: boolean | null | undefined;
            reasoningEfforts?: string[] | null | undefined;
            defaultReasoningEffort?: string | null | undefined;
            canDisableThinking?: boolean | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
            id: z<string, string, "defined">;
            name: z<string, string, "plain">;
            contextWindow: z<number, number, "plain">;
            maxTokens: z<number, number, "plain">;
            supportsImages: z<boolean, boolean, "plain">;
            reasoningEfforts: z<string[], string[], "plain">;
            defaultReasoningEffort: z<string, string, "plain">;
            canDisableThinking: z<boolean, boolean, "plain">;
        }>>[], "defined">;
    }>>, "plain">;
}>>, "plain">;
