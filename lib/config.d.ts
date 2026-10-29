import z from '@deepseek-ai/schemastery';
import type { PluginConfig as WorkBuddyOptions } from './components/workbuddy/config.js';
import type { Options as CodexOptions } from './components/codex/config.js';
export interface PluginConfig {
    workbuddy: WorkBuddyOptions;
    codex: CodexOptions;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    workbuddy: z<Schemastery.ObjectS<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
    }>>, "plain">;
    codex: z<Schemastery.ObjectS<NoInfer<{
        codexHome: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        codexHome: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    workbuddy: z<Schemastery.ObjectS<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        mode: z<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: z<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: z<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        environment: z<"internal" | "overseas" | "ioa", "internal" | "overseas" | "ioa", "defined">;
        baseURL: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
        includeUsage: z<boolean, boolean, "defined">;
    }>>, "plain">;
    codex: z<Schemastery.ObjectS<NoInfer<{
        codexHome: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        codexHome: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>, "plain">;
}>>, "plain">;
