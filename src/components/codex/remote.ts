import { z } from 'zod'
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

export const Action = z.enum(['status', 'refresh'])
export type ControlAction = z.infer<typeof Action>
const Reply = z.object({ configured: z.boolean(), models: z.number(), source: z.enum(['cache', 'live']).optional(), issue: z.string().optional() })
export type ControlReply = z.infer<typeof Reply>
const codec = (schema: z.ZodType, name: string) => ({ mode: 'strict' as const,
  typeSymbol: 'dsh-provider#codex:' + name, create: () => schema, jsonSchema: z.toJSONSchema(schema) })
const actionCodec = codec(Action, 'action')
export const REMOTE = createTypertRemoteInfo({ package: 'dsh-provider', methods: {
  'codexProvider/command': {
    service: 'codexProvider', invocation: { kind: 'direct' },
    parameters: [{ name: 'action', source: 'json', codec: actionCodec, strictCodec: actionCodec }],
    result: codec(Reply, 'reply'),
  },
} }, z)
export default REMOTE

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    codexProvider: { command(action: ControlAction): Promise<RemoteResult<ControlReply>> }
  }
}
