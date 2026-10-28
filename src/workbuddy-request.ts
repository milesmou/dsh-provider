import { createHash, randomUUID } from 'node:crypto'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions'

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32)

/** Normalize provider wire names and IDs while DSH keeps its original tools. */
export function workbuddyRequest(input: ChatCompletionCreateParamsStreaming, options: GenerateOptions) {
  const body = structuredClone(input)
  if (body.messages[0]?.role !== 'system') body.messages.unshift({ role: 'system', content: 'You are a helpful assistant.' })
  const names = new Map<string, string>()
  const aliases = new Map<string, string>()
  const alias = (name: string): string => {
    let wire = aliases.get(name)
    if (wire) return wire
    wire = /^[A-Za-z0-9_-]{1,64}$/.test(name) ? name : 'tool_' + hash(name)
    if (names.has(wire) && names.get(wire) !== name) wire = 'tool_' + hash(name + '_')
    aliases.set(name, wire); names.set(wire, name)
    return wire
  }
  for (const tool of body.tools ?? []) {
    if (tool.type !== 'function') continue
    tool.function.name = alias(tool.function.name)
    if (tool.function.parameters && typeof tool.function.parameters === 'object') {
      tool.function.parameters.type ??= 'object'
    }
  }
  for (const message of body.messages) {
    if (message.role === 'assistant') {
      const item = message as typeof message & { reasoning_content?: string; reasoning?: string }
      if (item.reasoning_content) { item.reasoning = item.reasoning_content; delete item.reasoning_content }
      for (const call of message.tool_calls ?? []) {
        if (call.type !== 'function') continue
        call.function.name = alias(call.function.name)
        call.id = /^[a-f0-9]{32}$/.test(call.id) ? call.id : hash(call.id)
      }
    } else if (message.role === 'tool') {
      message.tool_call_id = /^[a-f0-9]{32}$/.test(message.tool_call_id) ? message.tool_call_id : hash(message.tool_call_id)
    }
  }
  const userIndex = options.messages.findLastIndex(message => message.role === 'user')
  const conversation = options.sessionId || hash(JSON.stringify(options.messages.find(message => message.role === 'user') ?? 'one-shot'))
  const request = hash(conversation + JSON.stringify(userIndex < 0 ? options.messages : options.messages.slice(0, userIndex + 1)))
  const id = randomUUID().replaceAll('-', '')
  return { body, names, headers: {
    'X-Conversation-ID': conversation, 'X-Conversation-Request-ID': request,
    'X-Conversation-Message-ID': id, 'X-Request-ID': id,
  } }
}
