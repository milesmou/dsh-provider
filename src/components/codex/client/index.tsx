import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { PROVIDER_CARDS_SLOT } from '../../../client/settings-page.js'
import { CodexCard } from './card.js'
import type { CodexActions } from './card.js'

export const name = 'codex-component-settings'
export const inject = ['slots', 'remote']

export function apply(ctx: Context): void {
  ctx.inject(['remote.codexProvider'], child => {
    const actions: CodexActions = { command: async action => {
      const result = await child.remote.codexProvider.command(action)
      if (!result.ok) throw new Error('Codex operation unavailable')
      return result.value
    } }
    child.slots.inject(PROVIDER_CARDS_SLOT, () => child.slots.register({
      name: PROVIDER_CARDS_SLOT, id: 'codex', order: 30, inject: () => ({ actions }),
    }, CodexCard))
  })
}
