import z from '@deepseek-ai/schemastery'
import { Config as WorkBuddyConfig } from './components/workbuddy/config.js'
import type { PluginConfig as WorkBuddyOptions } from './components/workbuddy/config.js'
import { Config as CodexConfig } from './components/codex/config.js'
import type { Options as CodexOptions } from './components/codex/config.js'

export interface PluginConfig { workbuddy: WorkBuddyOptions; codex: CodexOptions }
export const Config = z.object({ workbuddy: WorkBuddyConfig, codex: CodexConfig })
