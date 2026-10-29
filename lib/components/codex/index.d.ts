import type { Context } from '@deepseek-ai/cordis';
import type { Options } from './config.js';
export { Config } from './config.js';
export type { Options } from './config.js';
export declare const name = "codex";
export declare const inject: string[];
export declare function apply(ctx: Context, config: Options): void;
