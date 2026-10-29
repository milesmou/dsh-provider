import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { PROVIDER_CARDS_SLOT } from '../../../client/settings-page.js'
import { CodexCard } from './card.js'
import type { CodexActions } from './card.js'
import { QuotaBadge } from './quota-badge.js'
import { sessionSelection } from '../../../client/session-selection.js'
import { modelManagementActions } from '../../../client/model-manager.js'

export const name = 'codex-component-settings'
export const inject = ['slots', 'remote']

export function apply(ctx: Context): void {
  ctx.inject(['remote.codexProvider', 'remote.settings'], child => {
    const modelActions = modelManagementActions(child, { namespace: 'dsh-provider-codex', models: async refresh => {
      const result = await child.remote.codexProvider.models(refresh)
      if (!result.ok) throw new Error('Codex models unavailable')
      return result.value
    } })
    const actions: CodexActions = { command: async action => {
      const result = await child.remote.codexProvider.command(action)
      if (!result.ok) throw new Error('Codex operation unavailable')
      return result.value
    } }
    child.slots.inject(PROVIDER_CARDS_SLOT, () => child.slots.register({
      name: PROVIDER_CARDS_SLOT, id: 'codex', order: 30, inject: () => ({ actions, modelActions }),
    }, CodexCard))
  })
  ctx.inject(['remote.codexProvider', 'modelDirectories'], child => {
    const read = async (refresh: boolean) => {
      const result = await child.remote.codexProvider.quota(refresh)
      if (!result.ok) throw new Error('Codex quota unavailable')
      return result.value
    }
    const slots = child.slots as unknown as {
      inject(name: string, callback: () => () => void): void
      register(options: Record<string, unknown>, component: unknown): () => void
    }
    slots.inject('conversation.session.header.utilities', () => slots.register({
      name: 'conversation.session.header.utilities', id: 'codex-quota', order: -20,
      inject: () => ({ read, selection: (sessionId: string) => sessionSelection(child, sessionId) }),
    }, QuotaBadge))
  })
}
