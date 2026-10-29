import z from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
export interface Options {
    codexHome: string;
    timeoutMs: number;
    hiddenModels: Volatile<string[]>;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    codexHome: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
    hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    codexHome: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
    hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
}>>, "plain">;
export declare const MODEL_ROUTE = "codex";
export declare const BASE_URL = "https://chatgpt.com/backend-api/codex";
