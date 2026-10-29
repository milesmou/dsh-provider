import type { Context } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type { ImageBlock } from '@deepseek-ai/dsh-llm'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { CodexAdapter } from './adapter.js'
import { CodexCatalog } from './catalog.js'
import { CodexSession, resolveCodexHome } from './session.js'
import { MODEL_ROUTE } from './config.js'
import type { Options } from './config.js'
import { CodexController } from './controller.js'

export { Config } from './config.js'
export type { Options } from './config.js'
export const name = 'codex'
export const inject = ['llm']

interface AttachmentsService {
  readImageRequest(ref: ImageBlock['attachment'], target: { width: number; height: number; maxBytes: number },
    signal?: AbortSignal): Promise<{ data: Uint8Array | ArrayBuffer; mediaType: string }>
}

export function apply(ctx: Context, config: Options): void {
  const environment = launchEnvironmentOf(ctx)
  const session = new CodexSession(resolveCodexHome(config.codexHome, environment.get('CODEX_HOME')?.value))
  const catalog = new CodexCatalog(session, () => ctx.emit('llm/adapters-updated'))
  const adapter = new CodexAdapter(config, { catalog, authenticate: signal => session.authenticate(signal),
    resolveImage: async (ref, signal) => {
      const attachments = ctx.get('attachments') as AttachmentsService | undefined
      if (!attachments?.readImageRequest) throw new LlmError('Codex: 当前部署未启用附件服务。', 'UNSUPPORTED_CONTENT')
      const image = await attachments.readImageRequest(ref, { width: ref.width, height: ref.height, maxBytes: ref.bytes }, signal)
      return `data:${image.mediaType};base64,${Buffer.from(image.data instanceof Uint8Array ? image.data : new Uint8Array(image.data)).toString('base64')}`
    },
  })
  ctx.llm.registerAdapter([MODEL_ROUTE], adapter)
  ctx.plugin(CodexController, { session, catalog })
  ctx.effect(() => () => catalog.dispose())
  void catalog.refresh()
}
