import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import * as workbuddy from './index.js'
import type { PluginConfig } from '../../config.js'

// Keep the original entry id and namespaced settings so existing accounts and
// model preferences survive the move to a separately managed Loader component.
export { Config } from '../../config.js'
export type { PluginConfig } from '../../config.js'
export const name = 'codebuddy'
export const inject = workbuddy.inject

export function apply(ctx: Context, config: PluginConfig): void {
  workbuddy.apply(ctx, config.workbuddy)
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
