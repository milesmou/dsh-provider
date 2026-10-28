import { z } from 'zod';
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info';
export const Action = z.enum(['status', 'login', 'poll', 'cancel', 'desktop']);
const Reply = z.object({
    configured: z.boolean().optional(), source: z.enum(['desktop', 'browser']).optional(),
    issue: z.string().optional(), url: z.string().optional(), pending: z.boolean().optional(),
});
const codec = (schema, name) => ({ mode: 'strict',
    typeSymbol: 'dsh-provider#workbuddy:' + name, create: () => schema,
    jsonSchema: z.toJSONSchema(schema), });
const actionCodec = codec(Action, 'action');
export const REMOTE = createTypertRemoteInfo({ package: 'dsh-provider', methods: {
        'workbuddyProvider/command': {
            service: 'workbuddyProvider', invocation: { kind: 'direct' },
            parameters: [{ name: 'action', source: 'json', codec: actionCodec, strictCodec: actionCodec }],
            result: codec(Reply, 'reply'),
        },
    } }, z);
export default REMOTE;
//# sourceMappingURL=remote.js.map