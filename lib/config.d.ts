import z from '@deepseek-ai/schemastery';
import type { PluginConfig as WorkBuddyOptions } from './components/workbuddy/config.js';
export interface PluginConfig {
    workbuddy: WorkBuddyOptions;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    workbuddy: z<Schemastery.ObjectS<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
    }>>, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    workbuddy: z<Schemastery.ObjectS<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
    }>>, "plain">;
}>>, "plain">;
