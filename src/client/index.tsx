import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { CodeBuddyKeyCard } from './card.js'
import type { CredentialActions } from './card.js'

const NS = 'llm-codebuddy-provider'
export const name = 'codebuddy-provider-settings'
export const inject = ['slots', 'remote', 'remote.credentials', 'remote.settings']

/** The standard credentials Remote handles all writes; config holds only a reference. */
export function apply(ctx: Context): void {
  async function reference(): Promise<string> {
    const result = await ctx.remote.settings.describe()
    if (!result.ok) throw new Error('Settings unavailable')
    const section = result.value.namespaces.find(entry => entry.ns === NS)
    const value = section?.value as { apiKeyEnv?: unknown } | undefined
    if (typeof value?.apiKeyEnv !== 'string') throw new Error('CodeBuddy settings unavailable')
    return value.apiKeyEnv
  }
  const actions: CredentialActions = {
    status: async () => {
      const ref = await reference()
      const response = await ctx.remote.credentials.describe([ref])
      if (!response.ok || !response.value[ref]) throw new Error('Credential state unavailable')
      const info = response.value[ref]
      return { configured: info.configured, writable: info.writable }
    },
    save: async value => {
      const trimmed = value.trim()
      if (!trimmed || /[^\x21-\x7e]/.test(trimmed)) throw new Error('Invalid credential')
      const response = await ctx.remote.credentials.set(await reference(), trimmed)
      if (!response.ok) throw new Error('Credential write refused')
    },
  }
  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({
    name: 'settings.models.footer', id: 'codebuddy-api-key', order: 20,
    inject: () => ({ actions }),
  }, CodeBuddyKeyCard))
}
