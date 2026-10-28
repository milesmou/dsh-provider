import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { ProviderCard } from './provider-card.js'
import type { ConnectionActions } from './provider-card.js'
import type { CredentialActions } from './card.js'
import { API_KEY_REF } from '../credential.js'
import { REMOTE } from '../remote.js'

export const name = 'codebuddy-provider-settings'
export const inject = ['slots', 'remote', 'remote.credentials', 'remote.settings']

/** The standard credentials Remote handles storage; environment sources are ignored. */
export async function apply(ctx: Context): Promise<void> {
  const dispose = await ctx.remote.$mount(REMOTE)
  ctx.effect(() => dispose)
  ctx.inject(['remote.codebuddyProvider'], mountCard)
}

function mountCard(ctx: Context): void {
  const section = async () => {
    const response = await ctx.remote.settings.describe()
    if (!response.ok) throw new Error('Settings unavailable')
    const value = response.value.namespaces.find(item => item.ns === 'llm-codebuddy-provider')
    if (!value) throw new Error('Provider unavailable')
    return { response: response.value, value }
  }
  const connection: ConnectionActions = {
    control: async action => {
      const result = await ctx.remote.codebuddyProvider.command(action)
      if (!result.ok) throw new Error('WorkBuddy operation unavailable')
      return result.value
    },
    status: async () => {
      const { response, value } = await section()
      const settings = value.value as { mode?: string; workbuddyRegion?: string }
      const mode = settings.mode === 'workbuddy' ? 'workbuddy' : 'api'
      const region = settings.workbuddyRegion === 'intl' ? 'intl' : 'cn'
      const login = mode === 'workbuddy' ? await connection.control('status') : undefined
      return { mode, region, writable: response.writable,
        ...(login ? { login: { configured: !!login.configured, source: login.source, issue: login.issue } } : {}) }
    },
    select: async (mode, region) => {
      const { value } = await section()
      const result = await ctx.remote.settings.update(value.ns, { mode, workbuddyRegion: region }, value.revision)
      if (!result.ok) throw new Error('Settings write refused')
    },
  }
  const actions: CredentialActions = {
    status: async () => {
      const ref = API_KEY_REF
      const response = await ctx.remote.credentials.describe([ref])
      if (!response.ok || !response.value[ref]) throw new Error('Credential state unavailable')
      const info = response.value[ref]
      return { configured: info.configured && info.source === 'file', writable: info.writable }
    },
    save: async value => {
      const trimmed = value.trim()
      if (!trimmed || /[^\x21-\x7e]/.test(trimmed)) throw new Error('Invalid credential')
      const response = await ctx.remote.credentials.set(API_KEY_REF, trimmed)
      if (!response.ok) throw new Error('Credential write refused')
    },
  }
  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({
    name: 'settings.models.footer', id: 'codebuddy-api-key', order: 20,
    inject: () => ({ actions, connection }),
  }, ProviderCard))
}
