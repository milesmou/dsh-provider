import type { Context } from '@deepseek-ai/cordis'
import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { LlmAdapter, LlmError, assertUsableApiKey } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, ImageBlock } from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-settings'
import { CodeBuddyAdapter } from './adapter.js'
import type { Connection } from './adapter.js'
import { ModelCatalog } from './catalog.js'
import { resolveBaseURL, baselineModels } from './config.js'
import type { PluginConfig } from './config.js'
import { API_KEY_REF } from './credential.js'
import { SETTINGS_NAMESPACE, MODEL_ROUTE } from './identity.js'
import { WorkBuddySession, SITES } from './session.js'
import type { WorkBuddyRegion } from './session.js'
import { CreditLedger } from './credits.js'
import { WorkBuddyController } from './controller.js'

export { Config } from './config.js'
export type { Options, ModelConfig, Mode } from './config.js'
export const name = 'workbuddy'
export const inject = ['llm']
/** Hold one adapter generation for an entire prepared call. */
class SwitchingAdapter extends LlmAdapter {
  constructor(private readonly current: () => CodeBuddyAdapter) { super() }
  override providerInfo(provider: string) { return this.current().providerInfo(provider) }
  override listModels(provider: string) { return this.current().listModels(provider) }
  override resolveModel(provider: string, model: string) { return this.current().resolveModel(provider, model) }
  override prepareCall(provider: string, model: string, signal?: AbortSignal) { return this.current().prepareCall(provider, model, signal) }
  override stream(options: GenerateOptions) { return this.current().stream(options) }
}

/** Structural slice of the attachment service this plugin consumes. */
interface AttachmentsService {
  readImageRequest(ref: ImageBlock['attachment'], target: { width: number; height: number; maxBytes: number },
    signal?: AbortSignal): Promise<{ data: Uint8Array | ArrayBuffer; mediaType: string }>
}

/**
 * Build the WorkBuddy image resolver: read one durable image at its native
 * request target through the attachment service, then encode it as the base64
 * data URL OpenAI-compatible chat endpoints accept. Returns undefined when the
 * deployment mounts no attachment service, so image blocks degrade to the
 * framework's text-only placeholder instead of failing the request.
 */
function imageResolver(ctx: Context): Connection['resolveImage'] {
  return async (ref, signal) => {
    const attachments = ctx.get('attachments') as AttachmentsService | undefined
    if (!attachments?.readImageRequest) throw new LlmError('当前部署未启用附件服务，无法读取图片。', 'UNSUPPORTED_CONTENT')
    const target = { width: ref.width, height: ref.height, maxBytes: ref.bytes }
    const image = await attachments.readImageRequest(ref, target, signal)
    const bytes = image.data instanceof Uint8Array ? image.data : new Uint8Array(image.data)
    return `data:${image.mediaType};base64,${Buffer.from(bytes).toString('base64')}`
  }
}

export function apply(ctx: Context, config: PluginConfig): void {
  const { mode, workbuddyRegion, contextWindow, ...options } = config
  const environment = launchEnvironmentOf(ctx)
  const ref = credentialRef(API_KEY_REF)
  const sessions = new Map<WorkBuddyRegion, WorkBuddySession>()
  const ledgerFile = join(resolveDshHome(), 'storages', 'dsh-provider-credits.json')
  const ledger = new CreditLedger(ledgerFile)
  let catalog: ModelCatalog | undefined
  let adapter: CodeBuddyAdapter
  let selection = ''
  const session = () => {
    const region = workbuddyRegion.get()
    let found = sessions.get(region)
    if (!found) {
      found = new WorkBuddySession(region, () => ctx.get('credentials'), () => {
        if (mode.get() === 'workbuddy' && workbuddyRegion.get() === region) catalog?.credentialsChanged()
      })
      sessions.set(region, found)
    }
    return found
  }
  function rebuild() {
    for (const value of sessions.values()) value.cancelLogin()
    catalog?.dispose()
    selection = mode.get() + ':' + workbuddyRegion.get()
    const resolveImage = imageResolver(ctx)
    let connection: Connection & { catalogURL?: string }
    if (mode.get() === 'workbuddy') {
      const login = session()
      const site = SITES[login.region]
      connection = { baseURL: site.endpoint + '/v2', catalogURL: site.endpoint + '/v3/config',
        authenticate: signal => login.authenticate(signal), workbuddy: true, resolveImage,
        recordCredit: (sessionId, credit) => ledger.add(sessionId, credit),
        providerName: login.region === 'cn' ? 'WorkBuddy' : 'WorkBuddy AI',
      }
    } else {
      connection = {
        baseURL: resolveBaseURL(options, key => environment.get(key)?.value),
        resolveImage,
        resolveApiKey: async () => {
          const credential = await ctx.get('credentials')?.resolve(ref)
          const raw = credential?.source === 'file' ? credential.value : undefined
          if (!raw?.trim()) throw new LlmError('CodeBuddy: save an API key in Settings → Models → CodeBuddy API.', 'MISSING_CREDENTIAL')
          return assertUsableApiKey(raw, 'dsh-provider', ref)
        },
      }
    }
    const models = baselineModels(mode.get(), workbuddyRegion.get())
    connection.fallback = models
    catalog = new ModelCatalog(models, connection, () => ctx.emit('llm/adapters-updated'), () => contextWindow.get())
    adapter = new CodeBuddyAdapter(structuredClone(options), { ...connection, catalog })
    void catalog.refresh()
  }
  rebuild()
  ctx.llm.registerAdapter([MODEL_ROUTE], new SwitchingAdapter(() => adapter))
  ctx.plugin(WorkBuddyController, { session, ledger, enabled: () => mode.get() === 'workbuddy' })
  ctx.inject(['credentials'], () => { catalog?.credentialsChanged() })
  ctx.on('credentials/reference-updated', updated => {
    if (updated === ref && mode.get() === 'api') catalog?.credentialsChanged()
  })
  ctx.on('settings/document-updated', ns => {
    if (ns !== SETTINGS_NAMESPACE) return
    if (selection !== mode.get() + ':' + workbuddyRegion.get()) rebuild()
    ctx.emit('llm/adapters-updated')
  })
  ctx.effect(() => () => {
    catalog?.dispose()
    for (const value of sessions.values()) value.dispose()
    void ledger.persist()
  })
}
