import type { Context } from '@deepseek-ai/cordis';
import type { PluginConfig } from './config.js';
export declare const Config: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
    workbuddy: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
        mode: import("@deepseek-ai/schemastery").default<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: import("@deepseek-ai/schemastery").default<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: import("@deepseek-ai/schemastery").default<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        hiddenModels: import("@deepseek-ai/schemastery").default<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
        environment: import("@deepseek-ai/schemastery").default<"internal" | "overseas", "internal" | "overseas", "defined">;
        timeoutMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        includeUsage: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        mode: import("@deepseek-ai/schemastery").default<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: import("@deepseek-ai/schemastery").default<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: import("@deepseek-ai/schemastery").default<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        hiddenModels: import("@deepseek-ai/schemastery").default<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
        environment: import("@deepseek-ai/schemastery").default<"internal" | "overseas", "internal" | "overseas", "defined">;
        timeoutMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        includeUsage: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
    }>>, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    workbuddy: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
        mode: import("@deepseek-ai/schemastery").default<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: import("@deepseek-ai/schemastery").default<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: import("@deepseek-ai/schemastery").default<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        hiddenModels: import("@deepseek-ai/schemastery").default<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
        environment: import("@deepseek-ai/schemastery").default<"internal" | "overseas", "internal" | "overseas", "defined">;
        timeoutMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        includeUsage: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        mode: import("@deepseek-ai/schemastery").default<"workbuddy" | "api", "workbuddy" | "api", "volatile-defined">;
        workbuddyRegion: import("@deepseek-ai/schemastery").default<"cn" | "intl", "cn" | "intl", "volatile-defined">;
        contextWindow: import("@deepseek-ai/schemastery").default<"light" | "middle" | "max", "light" | "middle" | "max", "volatile-defined">;
        hiddenModels: import("@deepseek-ai/schemastery").default<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
        environment: import("@deepseek-ai/schemastery").default<"internal" | "overseas", "internal" | "overseas", "defined">;
        timeoutMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        includeUsage: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
    }>>, "plain">;
}>>, "plain">;
export declare const inject: string[];
export type { PluginConfig } from './components/workbuddy/entry.js';
export declare const name = "dsh-provider";
export declare function apply(ctx: Context, config: PluginConfig): void;
