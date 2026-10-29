import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { REMOTE } from '../remote.js'
import * as settingsPage from './settings-page.js'
import * as componentLifecycle from './component-lifecycle.js'

export const name = 'dsh-provider-settings'
export const inject = ['remote']
export async function apply(ctx: Context): Promise<void> {
  const dispose = await ctx.remote.$mount(REMOTE)
  ctx.effect(() => dispose)
  ctx.plugin(settingsPage)
  ctx.plugin(componentLifecycle)
}
