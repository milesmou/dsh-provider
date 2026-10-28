import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions';
/** Normalize provider wire names and IDs while DSH keeps its original tools. */
export declare function workbuddyRequest(input: ChatCompletionCreateParamsStreaming, options: GenerateOptions): {
    body: ChatCompletionCreateParamsStreaming;
    names: Map<string, string>;
    headers: {
        'X-Conversation-ID': string;
        'X-Conversation-Request-ID': string;
        'X-Conversation-Message-ID': string;
        'X-Request-ID': string;
    };
};
