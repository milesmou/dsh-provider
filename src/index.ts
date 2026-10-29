import type { Context } from '@deepseek-ai/cordis'
import { Group } from '@deepseek-ai/cordis-plugin-loader'
import * as codebuddy from './components/workbuddy/entry.js'
import type { PluginConfig } from './config.js'

// DSH discovers a package's browser bundle only from a package-root Loader row.
// The bundle mounts this root as an empty group to load the shared settings UI;
// the two provider entries remain independently manageable. Object config keeps
// profiles using the original CodeBuddy root entry backwards compatible.
export const Config = codebuddy.Config
export const inject = codebuddy.inject
export type { PluginConfig } from './components/workbuddy/entry.js'
export const name = 'dsh-provider'

export function apply(ctx: Context, config: PluginConfig): void {
  if (ctx.fiber.entry?.options.group) ctx.plugin(Group, [])
  else codebuddy.apply(ctx, config)
}
