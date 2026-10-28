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
  typeSymbol: 'dsh-codebuddy-provider#' + name, create: () => schema,
  jsonSchema: z.toJSONSchema(schema),
})
const actionCodec = codec(Action, 'action')
export const REMOTE = createTypertRemoteInfo({ package: 'dsh-codebuddy-provider', methods: {
  'codebuddyProvider/command': {
    service: 'codebuddyProvider', invocation: { kind: 'direct' },
    parameters: [{ name: 'action', source: 'json', codec: actionCodec, strictCodec: actionCodec }],
    result: codec(Reply, 'reply'),
  },
} }, z)
export default REMOTE
export const TYPERT = {
  package: 'dsh-codebuddy-provider', face: 'host', schemas: [],
  get invocations() { return REMOTE.descriptors },
  model: { services: [], events: [], objects: [] },
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    codebuddyProvider: { command(action: ControlAction): Promise<RemoteResult<ControlReply>> }
  }
}
