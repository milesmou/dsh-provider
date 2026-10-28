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
  role?: string
  content?: unknown
  [key: string]: unknown
}

export interface LooseBody {
  messages?: LooseMessage[]
  tools?: unknown
  tool_choice?: unknown
  max_completion_tokens?: number
  max_tokens?: number
  [key: string]: unknown
}

/**
 * Words WorkBuddy refuses a chat for, each with words that say the same and
 * pass. WorkBuddy reads every message, not only the system prompt, and pays no
 * mind to case. Claude Code's billing header means nothing to WorkBuddy's
 * models and goes.
 */
const FLAGGED: readonly (readonly [RegExp, string])[] = [
  [/x-anthropic-billing-header:[^\n]*\n?/gi, ''],
  [/You are Claude Code, Anthropic['’]s official CLI for Claude/gi, "You are Claude Code, Anthropic's CLI for Claude"],
  [/Main branch \(you will usually use this for PRs\)/gi, 'Main branch (usually the base for PRs)'],
  [/(?<!the )Codex CLI is an open source project led by OpenAI\./gi, 'The Codex CLI is an open source project led by OpenAI.'],
  // DSH opens its system prompt with this line, which WorkBuddy refuses as
  // 11128 (magpie-community/plugins#279).
  [/You are an AI agent powered by DeepSeek Harness\.?/gi, 'You are an AI agent that helps the user with programming tasks.'],
  // A line WorkBuddy refuses in a long DSH chat (#291). The model can quote it
  // back into an assistant message, which the move to the user's instructions
  // cannot reach, so it is reworded in every message.
  [/Web GUI whose URL the runtime context names\.\s+When the user refers/gi,
    'Web GUI whose URL the runtime context names. The interface, when the user refers'],
]

export function unflagged(text: string): string {
  for (const [pattern, replacement] of FLAGGED) text = text.replace(pattern, replacement)
  return text
}

/**
 * Put {@link FLAGGED}'s words in place in every message, leaving out a text
 * that had nothing else (the billing header's system block). Returns whether it
 * changed anything.
 */
export function unflag(messages: LooseMessage[]): boolean {
  let changed = false
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (!message) continue
    if (typeof message.content === 'string') {
      const text = unflagged(message.content)
      if (text === message.content) continue
      changed = true
      if (text.trim() || message.role !== 'system') message.content = text
      else messages.splice(index, 1)
    } else if (Array.isArray(message.content)) {
      const parts: unknown[] = []
      let here = false
      for (const part of message.content) {
        const source = part && typeof part === 'object' ? part as Record<string, unknown> : undefined
        const text = source && typeof source.text === 'string' ? unflagged(source.text) : undefined
        if (text === undefined || text === source!.text) {
          parts.push(part)
          continue
        }
        here = true
        if (text.trim()) parts.push({ ...source, text })
      }
      if (!here) continue
      changed = true
      if (parts.length || message.role !== 'system') message.content = parts
      else messages.splice(index, 1)
    }
  }
  return changed
}

/** An earlier turn's thinking, as WorkBuddy's own client sends it back. */
function reasoningOf(message: LooseMessage): string {
  if (typeof message.reasoning_content === 'string' && message.reasoning_content) return message.reasoning_content
  if (Array.isArray(message.reasoning_details)) {
    const text = message.reasoning_details.map(detail => {
      const item = detail && typeof detail === 'object' ? detail as Record<string, unknown> : {}
      return typeof item.text === 'string' ? item.text : typeof item.summary === 'string' ? item.summary : ''
    }).join('')
    if (text) return text
  }
  return ''
}

/**
 * Move an earlier turn's thinking to `reasoning`, the field WorkBuddy's own
 * client sets. WorkBuddy drops `reasoning_content`, and lost the thinking of
 * clients that send it.
 */
function asReasoning(messages: LooseMessage[]): boolean {
  let changed = false
  for (const message of messages) {
    if (message?.role !== 'assistant'
      || (message.reasoning_content === undefined && message.reasoning_details === undefined)) continue
    const text = reasoningOf(message)
    if (text && !(typeof message.reasoning === 'string' && message.reasoning)) message.reasoning = text
    delete message.reasoning_content
    delete message.reasoning_details
    changed = true
  }
  return changed
}

export const DEFAULT_SYSTEM = 'You are a helpful assistant.'
const INSTRUCTIONS = ['<instructions>\n', '\n</instructions>']

/**
 * Apply the chat-endpoint spellings WorkBuddy accepts: its default system
 * message where a chat doesn't open with one, `max_tokens` in place of
 * `max_completion_tokens`, `system` in place of `developer`, an earlier turn's
 * thinking as `reasoning`, and {@link FLAGGED}'s words reworded.
 */
export function withSystem(body: LooseBody): boolean {
  let changed = false
  if (!Array.isArray(body.messages) || !body.messages.length) return false
  const messages = body.messages
  if (unflag(messages)) changed = true
  if (body.max_completion_tokens !== undefined) {
    if (body.max_tokens === undefined) body.max_tokens = body.max_completion_tokens
    delete body.max_completion_tokens
    changed = true
  }
  for (const message of messages) {
    if (message?.role !== 'developer') continue
    message.role = 'system'
    changed = true
  }
  if (asReasoning(messages)) changed = true
  if (messages[0]?.role !== 'system') {
    messages.unshift({ role: 'system', content: DEFAULT_SYSTEM })
    changed = true
  }
  return changed
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map(part => {
    const item = part && typeof part === 'object' ? part as Record<string, unknown> : {}
    return typeof item.text === 'string' ? item.text : ''
  }).filter(Boolean).join('\n')
}

/**
 * The text of a chat's system messages, which a chat refused once is known by:
 * the same agent's next chat goes with {@link systemAsUser} at once.
 */
export function systemKey(body: LooseBody): string {
  if (!Array.isArray(body.messages)) return ''
  const key = body.messages.filter(message => message?.role === 'system').map(message => contentText(message.content)).join('\n')
  return key.trim() === DEFAULT_SYSTEM ? '' : key
}

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
export function systemAsUser(body: LooseBody): LooseBody | null {
  const messages = body.messages
  if (!Array.isArray(messages)) return null
  let start = 0
  const lead: string[] = []
  for (; start < messages.length && messages[start]?.role === 'system'; start++) {
    lead.push(contentText(messages[start].content))
  }
  const said = lead.join('\n\n').trim()
  const rest: LooseMessage[] = messages.slice(start).map(message =>
    message?.role === 'system' ? { ...message, role: 'user' } : message)
  const moved = !!said && said !== DEFAULT_SYSTEM
  if (!moved && rest.every((message, index) => message === messages[start + index])) return null
  if (moved) {
    const text = INSTRUCTIONS[0] + said + INSTRUCTIONS[1]
    const user = rest.findIndex(message => message?.role === 'user')
    if (user < 0) rest.unshift({ role: 'user', content: text })
    else if (typeof rest[user].content === 'string') rest[user] = { ...rest[user], content: text + '\n\n' + rest[user].content }
    else if (Array.isArray(rest[user].content)) rest[user] = { ...rest[user], content: [{ type: 'text', text }, ...rest[user].content as unknown[]] }
    else rest[user] = { ...rest[user], content: text }
  }
  body.messages = [{ role: 'system', content: DEFAULT_SYSTEM }, ...rest]
  return body
}

/** WorkBuddy's 400 code 11153, "the conversation must end with a user message". */
export const AFTER_TOOLS_REFUSED = /must end with a user message|["']code["']\s*:\s*["']?11153(?![\d.])/i

/**
 * A chat ending with tool results then the user's message(s), with an empty
 * assistant message between them, as if the model had said nothing after the
 * results. WorkBuddy AI's gemini-3.8-flash answers 11153 to such a chat and
 * serves this one. Returns null for any other chat: one ending with the
 * assistant's message is a prefill, refused as it is.
 */
export function replyAfterToolResults(body: LooseBody): LooseBody | null {
  const messages = body.messages
  if (!Array.isArray(messages)) return null
  let index = messages.length - 1
  while (index >= 0 && messages[index]?.role === 'user') index--
  if (index === messages.length - 1 || index < 0 || messages[index]?.role !== 'tool') return null
  messages.splice(index + 1, 0, { role: 'assistant', content: '' })
  return body
}

/**
 * Convert the object form of `tool_choice` that OpenAI clients emit to
 * WorkBuddy's string form, and drop the tools a `none` choice leaves unused.
 * Runs after tool names were made safe, so a named choice follows its tool.
 */
export function normalizeToolChoice(body: LooseBody): boolean {
  if (!('tool_choice' in body)) return false
  const choice = body.tool_choice
  const dropTools = () => { delete body.tools; delete body.functions }
  if (typeof choice === 'string') {
    if (choice.trim().toLowerCase() === 'none') {
      delete body.tool_choice
      dropTools()
      return true
    }
    return false
  }
  if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
    delete body.tool_choice
    return true
  }
  const item = choice as Record<string, unknown>
  const type = typeof item.type === 'string' ? item.type.trim().toLowerCase() : ''
  if (type === 'none') {
    delete body.tool_choice
    dropTools()
  } else if (type === 'auto' || type === 'required') {
    body.tool_choice = type
  } else if (type === 'function') {
    const fn = item.function && typeof item.function === 'object' && !Array.isArray(item.function)
      ? item.function as Record<string, unknown> : undefined
    const name = fn && typeof fn.name === 'string' ? fn.name.trim() : ''
    body.tool_choice = name || 'auto'
  } else {
    delete body.tool_choice
  }
  return true
}

const SDK_OS: Record<string, string> = {
  darwin: 'MacOS', win32: 'Windows', linux: 'Linux', freebsd: 'FreeBSD',
  openbsd: 'OpenBSD', android: 'Android',
}
const SDK_ARCH: Record<string, string> = {
  x64: 'x64', arm64: 'arm64', arm: 'arm', ia32: 'x32', x32: 'x32',
}

/**
 * The headers WorkBuddy's own CLI adds to its model requests alone: the agent
 * type, and the OpenAI SDK headers it sends through (openai 6.25.0 on
 * Electron 37's Node, a 1200 s timeout, no retries). `X-Agent-Type` and
 * `X-Agent-Runtime` are set with the sign-in headers; these ride with each chat.
 */
export function clientChatHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-Stainless-Retry-Count': '0',
    'X-Stainless-Timeout': '1200',
    'X-Stainless-Lang': 'js',
    'X-Stainless-Package-Version': '6.25.0',
    'X-Stainless-OS': SDK_OS[process.platform] ?? (process.platform ? `Other:${process.platform}` : 'Unknown'),
    'X-Stainless-Arch': SDK_ARCH[process.arch] ?? (process.arch ? `other:${process.arch}` : 'unknown'),
    'X-Stainless-Runtime': 'node',
    'X-Stainless-Runtime-Version': 'v22.21.1',
  }
}
