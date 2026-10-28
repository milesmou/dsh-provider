import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions';
export interface PreparedRequest {
    body: ChatCompletionCreateParamsStreaming;
    /** Each wire name to the name DSH knows the tool by. */
    names: Map<string, string>;
    headers: Record<string, string>;
    /** The chat's system prompt, which a chat refused once is known by. */
    systemKey: string;
}
/**
 * Shape a chat for WorkBuddy's endpoint (see `shaping.ts` and `tool-schema.ts`)
 * and name the conversation the way WorkBuddy's own client does, so one user
 * send counts as one request however many steps it takes.
 */
export declare function workbuddyRequest(input: ChatCompletionCreateParamsStreaming, options: GenerateOptions): PreparedRequest;
