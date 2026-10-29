import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import * as workbuddy from './components/workbuddy/index.js'
import * as codex from './components/codex/index.js'
import type { PluginConfig } from './config.js'

export { Config } from './config.js'
export type { PluginConfig } from './config.js'
export const name = 'dsh-provider'
export const inject = ['llm']

/** Components own their routes and lifecycle; the root owns their configuration. */
export function apply(ctx: Context, config: PluginConfig): void {
  ctx.plugin({
    name: 'dsh-provider-workbuddy', inject: workbuddy.inject,
    apply: child => workbuddy.apply(child, config.workbuddy),
  })
  ctx.plugin({
    name: 'dsh-provider-codex', inject: codex.inject,
    apply: child => codex.apply(child, config.codex),
  })
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
