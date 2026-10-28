import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { CodeBuddyKeyCard } from './card.js'
import type { CredentialActions } from './card.js'
import { API_KEY_REF } from '../credential.js'

export const name = 'codebuddy-provider-settings'
export const inject = ['slots', 'remote', 'remote.credentials']

/** The standard credentials Remote handles storage; environment sources are ignored. */
export function apply(ctx: Context): void {
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
    inject: () => ({ actions }),
  }, CodeBuddyKeyCard))
}
