import type { Context } from '@deepseek-ai/cordis';
import type { PluginConfig } from '../../config.js';
export { Config } from '../../config.js';
export type { PluginConfig } from '../../config.js';
export declare const name = "codebuddy";
export declare const inject: string[];
export declare function apply(ctx: Context, config: PluginConfig): void;
