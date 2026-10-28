import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
export declare function toMessages(options: GenerateOptions): ChatCompletionMessageParam[];
