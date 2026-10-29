import { z } from 'zod';
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info';
export const Action = z.enum(['status', 'refresh']);
const Reply = z.object({ configured: z.boolean(), models: z.number(), source: z.enum(['cache', 'live']).optional(), issue: z.string().optional() });
export const QuotaReply = z.object({
    available: z.boolean(),
    windows: z.array(z.object({
        kind: z.enum(['primary', 'secondary']),
        usedPercent: z.number().min(0).max(100),
        windowDurationMins: z.number().positive().optional(),
        resetsAt: z.number().nonnegative().optional(),
    })),
    updatedAt: z.number().optional(), plan: z.string().optional(),
    stale: z.boolean().optional(), issue: z.string().optional(),
});
const codec = (schema, name) => ({ mode: 'strict',
    typeSymbol: 'dsh-provider#codex:' + name, create: () => schema, jsonSchema: z.toJSONSchema(schema) });
const actionCodec = codec(Action, 'action');
const refreshCodec = codec(z.boolean(), 'quotaRefresh');
export const REMOTE = createTypertRemoteInfo({ package: 'dsh-provider', methods: {
        'codexProvider/command': {
            service: 'codexProvider', invocation: { kind: 'direct' },
            parameters: [{ name: 'action', source: 'json', codec: actionCodec, strictCodec: actionCodec }],
            result: codec(Reply, 'reply'),
        },
        'codexProvider/quota': {
            service: 'codexProvider', invocation: { kind: 'direct' },
            parameters: [{ name: 'refresh', source: 'json', codec: refreshCodec, strictCodec: refreshCodec }],
            result: codec(QuotaReply, 'quota'),
        },
    } }, z);
export default REMOTE;
//# sourceMappingURL=remote.js.map