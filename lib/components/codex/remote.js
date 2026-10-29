import { z } from 'zod';
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info';
export const Action = z.enum(['status', 'refresh']);
const Reply = z.object({ configured: z.boolean(), models: z.number(), source: z.enum(['cache', 'live']).optional(), issue: z.string().optional() });
const codec = (schema, name) => ({ mode: 'strict',
    typeSymbol: 'dsh-provider#codex:' + name, create: () => schema, jsonSchema: z.toJSONSchema(schema) });
const actionCodec = codec(Action, 'action');
export const REMOTE = createTypertRemoteInfo({ package: 'dsh-provider', methods: {
        'codexProvider/command': {
            service: 'codexProvider', invocation: { kind: 'direct' },
            parameters: [{ name: 'action', source: 'json', codec: actionCodec, strictCodec: actionCodec }],
            result: codec(Reply, 'reply'),
        },
    } }, z);
export default REMOTE;
//# sourceMappingURL=remote.js.map