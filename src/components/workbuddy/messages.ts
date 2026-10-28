import { LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions } from '@deepseek-ai/dsh-llm'
import { textOnlyImageText } from '@deepseek-ai/dsh-llm'
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/chat/completions'

/**
 * Data URLs for images in one request, keyed by durable attachment id. The
 * adapter resolves these asynchronously (through the attachment service) before
 * message building, because the durable `ImageBlock` carries only a reference,
 * not bytes. A missing entry degrades to the framework's text-only placeholder.
 */
export type ImageDataUrls = ReadonlyMap<string, string>

function textOf(content: readonly ContentBlock[]): string {
  return content.map(block => {
    if (block.type === 'text') return block.text
    // The Harness projects files to text before reaching a model adapter.
    // Refuse unsupported blocks instead of silently dropping user input.
    throw new LlmError(`CodeBuddy: unsupported input block ${block.type}; this version accepts text.`, 'UNSUPPORTED_CONTENT')
  }).join('')
}

/**
 * Build the `content` of one user/tool message. A message with no image block
 * keeps the plain string form every turn already used; once an image is present
 * the content becomes the OpenAI multipart array, with each image a `image_url`
 * part carrying a base64 data URL. An image the adapter could not resolve (no
 * attachment service, or a read failure) becomes the same text-only placeholder
 * the framework emits for text-only models, so one unreadable image never fails
 * the whole request.
 */
function contentOf(content: readonly ContentBlock[], images: ImageDataUrls): string | ChatCompletionContentPart[] {
  if (!content.some(block => block.type === 'image')) return content.map(block => {
    if (block.type === 'text') return block.text
    throw new LlmError(`CodeBuddy: unsupported input block ${block.type}; this version accepts text.`, 'UNSUPPORTED_CONTENT')
  }).join('')
  const parts: ChatCompletionContentPart[] = []
  for (const block of content) {
    if (block.type === 'text') { parts.push({ type: 'text', text: block.text }); continue }
    if (block.type === 'image') {
      const url = images.get(String(block.attachment.attachmentId))
      parts.push(url
        ? { type: 'image_url', image_url: { url } }
        : { type: 'text', text: textOnlyImageText(block.attachment) })
      continue
    }
    throw new LlmError(`CodeBuddy: unsupported input block ${block.type}; this version accepts text and images.`, 'UNSUPPORTED_CONTENT')
  }
  return parts
}

export function toMessages(options: GenerateOptions, images: ImageDataUrls = new Map()): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = []
  if (options.system) messages.push({ role: 'system', content: options.system })
  for (const message of options.messages) {
    if (message.role === 'assistant') {
      const text: string[] = []
      const reasoning: string[] = []
      const calls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = []
      for (const block of message.content) {
        if (block.type === 'text') text.push(block.text)
        else if (block.type === 'reasoning') reasoning.push(block.text)
        else if (block.type === 'tool-call') calls.push({
          id: block.id, type: 'function', function: { name: block.name, arguments: block.arguments },
        })
        else throw new LlmError(`CodeBuddy: unsupported assistant block ${block.type}.`, 'UNSUPPORTED_CONTENT')
      }
      const item: ChatCompletionMessageParam & { reasoning_content?: string } = {
        role: 'assistant', content: text.join('') || null,
        ...(calls.length ? { tool_calls: calls } : {}),
      }
      // CodeBuddy's reasoning models may require this when replaying tool turns.
      if (reasoning.length) item.reasoning_content = reasoning.join('')
      messages.push(item)
    } else if (message.role === 'tool') {
      messages.push({ role: 'tool', tool_call_id: message.toolCallId, content: textOf(message.content) })
    } else if (message.role === 'developer') {
      // This adapter declares no incremental tool-update capability. The
      // Harness sends complete current tool schemas in options.tools, so the
      // notices about them carry nothing the model needs.
      const text = message.content.filter(block => block.type !== 'tool-addition' && block.type !== 'tool-removal')
      // WorkBuddy takes `system`; it has no `developer` role.
      if (text.length) messages.push({ role: 'system', content: textOf(text) })
    } else {
      messages.push({ role: message.role, content: contentOf(message.content, images) } as ChatCompletionMessageParam)
    }
  }
  return messages
}
