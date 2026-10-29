import z from '@deepseek-ai/schemastery';
export const Config = z.object({
    codexHome: z.string().default(''),
    timeoutMs: z.number().step(1).min(1).max(2147483647).default(180000),
    hiddenModels: z.array(z.string()).default([]).volatile(),
});
export const MODEL_ROUTE = 'codex';
export const BASE_URL = 'https://chatgpt.com/backend-api/codex';
//# sourceMappingURL=config.js.map