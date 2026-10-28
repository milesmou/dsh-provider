import type { Context } from '@deepseek-ai/cordis';
import type { PluginConfig } from './config.js';
export { Config } from './config.js';
export type { Options, ModelConfig, Mode } from './config.js';
export declare const name = "workbuddy";
export declare const inject: string[];
export declare function apply(ctx: Context, config: PluginConfig): void;
