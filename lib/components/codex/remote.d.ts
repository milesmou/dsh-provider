import { z } from 'zod';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
export declare const Action: z.ZodEnum<{
    refresh: "refresh";
    status: "status";
}>;
export type ControlAction = z.infer<typeof Action>;
declare const Reply: z.ZodObject<{
    configured: z.ZodBoolean;
    models: z.ZodNumber;
    source: z.ZodOptional<z.ZodEnum<{
        cache: "cache";
        live: "live";
    }>>;
    issue: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ControlReply = z.infer<typeof Reply>;
export declare const QuotaReply: z.ZodObject<{
    available: z.ZodBoolean;
    windows: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            primary: "primary";
            secondary: "secondary";
        }>;
        usedPercent: z.ZodNumber;
        windowDurationMins: z.ZodOptional<z.ZodNumber>;
        resetsAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    updatedAt: z.ZodOptional<z.ZodNumber>;
    plan: z.ZodOptional<z.ZodString>;
    stale: z.ZodOptional<z.ZodBoolean>;
    issue: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type QuotaView = z.infer<typeof QuotaReply>;
export declare const REMOTE: import("@deepseek-ai/dsh-typert-protocol").TypertRemoteInfo<Readonly<Record<string, import("@deepseek-ai/dsh-typert-protocol").TypertRemoteMethod<object, unknown, "unary", never, unknown> | import("@deepseek-ai/dsh-typert-protocol").TypertRemoteMethod<object, unknown, "stream", unknown, unknown>>>>;
export default REMOTE;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        codexProvider: {
            command(action: ControlAction): Promise<RemoteResult<ControlReply>>;
            quota(refresh: boolean): Promise<RemoteResult<QuotaView>>;
        };
    }
}
