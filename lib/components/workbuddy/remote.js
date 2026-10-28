import { z } from 'zod';
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info';
export const Action = z.enum(['status', 'login', 'poll', 'cancel', 'desktop']);
const Reply = z.object({
    configured: z.boolean().optional(), source: z.enum(['desktop', 'browser']).optional(),
    issue: z.string().optional(), url: z.string().optional(), pending: z.boolean().optional(),
});
const Credits = z.object({
    enabled: z.boolean(),
    sessionUsed: z.number().optional(),
    accountRemain: z.number().optional(),
    accountTotal: z.number().optional(),
    unit: z.string().optional(),
    plan: z.string().optional(),
});
const TurnCredit = z.object({ credits: z.number().optional() });
const codec = (schema, name) => ({ mode: 'strict',
    typeSymbol: 'dsh-provider#workbuddy:' + name, create: () => schema,
    jsonSchema: z.toJSONSchema(schema), });
const actionCodec = codec(Action, 'action');
const sessionIdCodec = codec(z.string(), 'sessionId');
const refreshCodec = codec(z.boolean(), 'refresh');
const messageIdCodec = codec(z.string(), 'messageId');
export const REMOTE = createTypertRemoteInfo({ package: 'dsh-provider', methods: {
        'workbuddyProvider/command': {
            service: 'workbuddyProvider', invocation: { kind: 'direct' },
            parameters: [{ name: 'action', source: 'json', codec: actionCodec, strictCodec: actionCodec }],
            result: codec(Reply, 'reply'),
        },
        'workbuddyProvider/credits': {
            service: 'workbuddyProvider', invocation: { kind: 'direct' },
            parameters: [
                { name: 'sessionId', source: 'json', codec: sessionIdCodec, strictCodec: sessionIdCodec },
                { name: 'refresh', source: 'json', codec: refreshCodec, strictCodec: refreshCodec },
            ],
            result: codec(Credits, 'credits'),
        },
        'workbuddyProvider/turnCredit': {
            service: 'workbuddyProvider', invocation: { kind: 'direct' },
            parameters: [
                { name: 'sessionId', source: 'json', codec: sessionIdCodec, strictCodec: sessionIdCodec },
                { name: 'messageId', source: 'json', codec: messageIdCodec, strictCodec: messageIdCodec },
            ],
            result: codec(TurnCredit, 'turnCredit'),
        },
    } }, z);
export default REMOTE;
//# sourceMappingURL=remote.js.map