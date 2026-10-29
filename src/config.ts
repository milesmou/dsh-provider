import z from '@deepseek-ai/schemastery'
import { Config as WorkBuddyConfig } from './components/workbuddy/config.js'
import type { PluginConfig as WorkBuddyOptions } from './components/workbuddy/config.js'

export interface PluginConfig { workbuddy: WorkBuddyOptions }
export const Config = z.object({ workbuddy: WorkBuddyConfig })
