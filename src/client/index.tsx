import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { REMOTE } from '../remote.js'
import * as workbuddy from '../components/workbuddy/client/index.js'
import * as codex from '../components/codex/client/index.js'
import * as settingsPage from './settings-page.js'
import * as modelLabel from './model-label.js'

export const name = 'dsh-provider-settings'
export const inject = ['remote']
export async function apply(ctx: Context): Promise<void> {
  const dispose = await ctx.remote.$mount(REMOTE)
  ctx.effect(() => dispose)
  ctx.plugin(settingsPage)
  ctx.plugin(modelLabel)
  ctx.plugin(workbuddy)
  ctx.plugin(codex)
}
