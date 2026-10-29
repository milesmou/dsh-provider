import { z } from 'zod';
export declare const ModelDirectory: z.ZodObject<{
    models: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        contextWindow: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    issue: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ModelDirectoryReply = z.infer<typeof ModelDirectory>;
export declare function modelDirectory(models: readonly {
    id: string;
    name?: string;
    contextWindow?: number;
}[], issue?: string): ModelDirectoryReply;
/** Visibility changes discovery only; resolution keeps supporting already selected models. */
export declare function visibleModels<T extends {
    id: string;
}>(models: readonly T[], hidden?: readonly string[]): T[];
