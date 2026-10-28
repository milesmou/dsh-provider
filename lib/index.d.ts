import type { Context } from '@deepseek-ai/cordis';
import type { PluginConfig } from './config.js';
export { Config } from './config.js';
export type { PluginConfig } from './config.js';
export declare const name = "dsh-provider";
export declare const inject: string[];
/** Components own their routes and lifecycle; the root owns their configuration. */
export declare function apply(ctx: Context, config: PluginConfig): void;
