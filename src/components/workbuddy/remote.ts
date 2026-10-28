import { z } from 'zod'
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

export const Action = z.enum(['status', 'login', 'poll', 'cancel', 'desktop'])
export type ControlAction = z.infer<typeof Action>
const Reply = z.object({
  configured: z.boolean().optional(), source: z.enum(['desktop', 'browser']).optional(),
  issue: z.string().optional(), url: z.string().optional(), pending: z.boolean().optional(),
})
export type ControlReply = z.infer<typeof Reply>
const codec = (schema: z.ZodType, name: string) => ({ mode: 'strict' as const,
  typeSymbol: 'dsh-provider#workbuddy:' + name, create: () => schema,
  jsonSchema: z.toJSONSchema(schema),
})
const actionCodec = codec(Action, 'action')
export const REMOTE = createTypertRemoteInfo({ package: 'dsh-provider', methods: {
  'workbuddyProvider/command': {
    service: 'workbuddyProvider', invocation: { kind: 'direct' },
    parameters: [{ name: 'action', source: 'json', codec: actionCodec, strictCodec: actionCodec }],
    result: codec(Reply, 'reply'),
  },
} }, z)
export default REMOTE

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    workbuddyProvider: { command(action: ControlAction): Promise<RemoteResult<ControlReply>> }
  }
}
