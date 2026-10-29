// Compatibility for profiles that still refer to the package root. The bundle
// declares CodeBuddy and Codex as separate Loader entries, each with its own switch.
export { Config, apply, inject } from './components/workbuddy/entry.js'
export type { PluginConfig } from './components/workbuddy/entry.js'
export const name = 'dsh-provider'
