import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { REMOTE } from '../remote.js'
import { CodexCard } from './card.js'
import type { CodexActions } from './card.js'

export const name = 'codex-component-settings'
export const inject = ['slots', 'remote']

export async function apply(ctx: Context): Promise<void> {
  const dispose = await ctx.remote.$mount(REMOTE)
  ctx.effect(() => dispose)
  ctx.inject(['remote.codexProvider'], child => {
    const actions: CodexActions = { command: async action => {
      const result = await child.remote.codexProvider.command(action)
      if (!result.ok) throw new Error('Codex operation unavailable')
      return result.value
    } }
    child.slots.inject('settings.models.footer', () => child.slots.register({
      name: 'settings.models.footer', id: 'codex', order: 30, inject: () => ({ actions }),
    }, CodexCard))
  })
}
