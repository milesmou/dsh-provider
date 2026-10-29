import { z } from 'zod'
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { ModelDirectory } from '../../model-management.js'
import type { ModelDirectoryReply } from '../../model-management.js'

export const Action = z.enum(['status', 'login', 'poll', 'cancel', 'desktop'])
export type ControlAction = z.infer<typeof Action>
const Reply = z.object({
  configured: z.boolean().optional(), source: z.enum(['desktop', 'browser']).optional(),
  issue: z.string().optional(), url: z.string().optional(), pending: z.boolean().optional(),
})
export type ControlReply = z.infer<typeof Reply>
const Credits = z.object({
  enabled: z.boolean(),
  sessionUsed: z.number().optional(),
  accountRemain: z.number().optional(),
  accountTotal: z.number().optional(),
  unit: z.string().optional(),
  plan: z.string().optional(),
  mode: z.enum(['api', 'workbuddy']).optional(),
  updatedAt: z.number().optional(),
  stale: z.boolean().optional(),
  issue: z.string().optional(),
})
export type CreditsReply = z.infer<typeof Credits>
const codec = (schema: z.ZodType, name: string) => ({ mode: 'strict' as const,
  typeSymbol: 'dsh-provider#workbuddy:' + name, create: () => schema,
  jsonSchema: z.toJSONSchema(schema),
})
const actionCodec = codec(Action, 'action')
const sessionIdCodec = codec(z.string(), 'sessionId')
const refreshCodec = codec(z.boolean(), 'refresh')
export const REMOTE = createTypertRemoteInfo({ package: 'dsh-provider', methods: {
  'workbuddyProvider/models': {
    service: 'workbuddyProvider', invocation: { kind: 'direct' },
    parameters: [{ name: 'refresh', source: 'json', codec: refreshCodec, strictCodec: refreshCodec }],
    result: codec(ModelDirectory, 'models'),
  },
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
} }, z)
export default REMOTE

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    workbuddyProvider: {
      command(action: ControlAction): Promise<RemoteResult<ControlReply>>
      credits(sessionId: string, refresh: boolean): Promise<RemoteResult<CreditsReply>>
      models(refresh: boolean): Promise<RemoteResult<ModelDirectoryReply>>
    }
  }
}
