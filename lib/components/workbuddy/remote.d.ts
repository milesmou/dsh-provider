import { z } from 'zod';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
export declare const Action: z.ZodEnum<{
    desktop: "desktop";
    status: "status";
    login: "login";
    poll: "poll";
    cancel: "cancel";
}>;
export type ControlAction = z.infer<typeof Action>;
declare const Reply: z.ZodObject<{
    configured: z.ZodOptional<z.ZodBoolean>;
    source: z.ZodOptional<z.ZodEnum<{
        desktop: "desktop";
        browser: "browser";
    }>>;
    issue: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    pending: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type ControlReply = z.infer<typeof Reply>;
declare const Credits: z.ZodObject<{
    enabled: z.ZodBoolean;
    sessionUsed: z.ZodOptional<z.ZodNumber>;
    accountRemain: z.ZodOptional<z.ZodNumber>;
    accountTotal: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
    plan: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreditsReply = z.infer<typeof Credits>;
export declare const REMOTE: import("@deepseek-ai/dsh-typert-protocol").TypertRemoteInfo<Readonly<Record<string, import("@deepseek-ai/dsh-typert-protocol").TypertRemoteMethod<object, unknown, "unary", never, unknown> | import("@deepseek-ai/dsh-typert-protocol").TypertRemoteMethod<object, unknown, "stream", unknown, unknown>>>>;
export default REMOTE;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        workbuddyProvider: {
            command(action: ControlAction): Promise<RemoteResult<ControlReply>>;
            credits(sessionId: string): Promise<RemoteResult<CreditsReply>>;
        };
    }
}
