/**
 * WorkBuddy's channel check refuses some clients' identity lines with 11128
 * "Illegal API invocation from an unapproved channel", and its chat endpoint
 * accepts a narrower request spelling than OpenAI-compatible clients emit.
 *
 * This module ports magpie's `packages/workbuddy` shaping (MIT): the rewording
 * table, the move of a refused system prompt into the user's words, and the
 * spellings WorkBuddy takes. Each rule was measured against a real account
 * there; the comments say which refusal each one answers.
 */
/** A message as the shaping code sees it: the OpenAI types are narrower than the wire allows. */
export interface LooseMessage {
    role?: string;
    content?: unknown;
    [key: string]: unknown;
}
export interface LooseBody {
    messages?: LooseMessage[];
    tools?: unknown;
    tool_choice?: unknown;
    max_completion_tokens?: number;
    max_tokens?: number;
    [key: string]: unknown;
}
export declare function unflagged(text: string): string;
/**
 * Put {@link FLAGGED}'s words in place in every message, leaving out a text
 * that had nothing else (the billing header's system block). Returns whether it
 * changed anything.
 */
export declare function unflag(messages: LooseMessage[]): boolean;
export declare const DEFAULT_SYSTEM = "You are a helpful assistant.";
/**
 * Apply the chat-endpoint spellings WorkBuddy accepts: its default system
 * message where a chat doesn't open with one, `max_tokens` in place of
 * `max_completion_tokens`, `system` in place of `developer`, an earlier turn's
 * thinking as `reasoning`, and {@link FLAGGED}'s words reworded.
 */
export declare function withSystem(body: LooseBody): boolean;
/**
 * The text of a chat's system messages, which a chat refused once is known by:
 * the same agent's next chat goes with {@link systemAsUser} at once.
 */
export declare function systemKey(body: LooseBody): string;
/**
 * WorkBuddy's channel check reads the system and assistant messages only: a
 * refused line in the user's message, a tool's result or a user message's part
 * is served. So a chat refused for its system prompt goes again with that
 * prompt read to the model as the first thing the user says, in
 * {@link INSTRUCTIONS}' tags, and WorkBuddy's default system prompt first (both
 * builds want a system message there). A system message later in the chat
 * becomes the user's where it stands.
 *
 * Mutates `body` and returns it, or returns null when there is nothing to move.
 */
export declare function systemAsUser(body: LooseBody): LooseBody | null;
/** WorkBuddy's 400 code 11153, "the conversation must end with a user message". */
export declare const AFTER_TOOLS_REFUSED: RegExp;
/**
 * A chat ending with tool results then the user's message(s), with an empty
 * assistant message between them, as if the model had said nothing after the
 * results. WorkBuddy AI's gemini-3.8-flash answers 11153 to such a chat and
 * serves this one. Returns null for any other chat: one ending with the
 * assistant's message is a prefill, refused as it is.
 */
export declare function replyAfterToolResults(body: LooseBody): LooseBody | null;
/**
 * Convert the object form of `tool_choice` that OpenAI clients emit to
 * WorkBuddy's string form, and drop the tools a `none` choice leaves unused.
 * Runs after tool names were made safe, so a named choice follows its tool.
 */
export declare function normalizeToolChoice(body: LooseBody): boolean;
/**
 * The headers WorkBuddy's own CLI adds to its model requests alone: the agent
 * type, and the OpenAI SDK headers it sends through (openai 6.25.0 on
 * Electron 37's Node, a 1200 s timeout, no retries). `X-Agent-Type` and
 * `X-Agent-Runtime` are set with the sign-in headers; these ride with each chat.
 */
export declare function clientChatHeaders(): Record<string, string>;
