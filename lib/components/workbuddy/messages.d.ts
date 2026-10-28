import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
/**
 * Data URLs for images in one request, keyed by durable attachment id. The
 * adapter resolves these asynchronously (through the attachment service) before
 * message building, because the durable `ImageBlock` carries only a reference,
 * not bytes. A missing entry degrades to the framework's text-only placeholder.
 */
export type ImageDataUrls = ReadonlyMap<string, string>;
export declare function toMessages(options: GenerateOptions, images?: ImageDataUrls): ChatCompletionMessageParam[];
