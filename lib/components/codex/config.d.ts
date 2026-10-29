import z from '@deepseek-ai/schemastery';
export interface Options {
    codexHome: string;
    timeoutMs: number;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    codexHome: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    codexHome: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
}>>, "plain">;
export declare const MODEL_ROUTE = "codex";
export declare const BASE_URL = "https://chatgpt.com/backend-api/codex";
