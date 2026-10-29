import type { Context } from '@deepseek-ai/cordis'
import * as workbuddy from '../components/workbuddy/client/index.js'
import * as codex from '../components/codex/client/index.js'

export const name = 'dsh-provider-settings'
export function apply(ctx: Context): void {
  ctx.plugin(workbuddy)
  ctx.plugin(codex)
}
