import OpenAI from 'openai'
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions'
import {
  LlmAdapter, LlmError, ToolCallId, ReasoningEffortId, ProviderRequestId,
  attributionHeaders, isContextWindowExceededError, isQuotaExceededError,
} from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, LlmResolvedModelInfo, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import type { ModelConfig, Options } from './config.js'
import { toMessages } from './messages.js'
import type { ModelCatalog } from './catalog.js'

interface Connection {
  baseURL: string
  resolveApiKey: () => Promise<string>
  fetch?: typeof fetch
  catalog?: ModelCatalog
}

interface BlockState {
  index: number
  type: 'text' | 'reasoning' | 'tool-call'
  text: string
  id?: string
  name: string
  emitted?: number
}

function usageOf(raw: Record<string, unknown>): TokenUsage {
  const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
  const prompt = count(raw.prompt_tokens)
  const details = raw.prompt_tokens_details as Record<string, unknown> | undefined
  const cache = Math.min(prompt, count(raw.prompt_cache_hit_tokens ?? details?.cached_tokens))
  const output = count(raw.completion_tokens)
  const completionDetails = raw.completion_tokens_details as Record<string, unknown> | undefined
  return {
    inputTokens: prompt - cache, outputTokens: output, totalTokens: prompt + output,
    ...(cache ? { cacheReadTokens: cache } : {}),
    ...(completionDetails?.reasoning_tokens === undefined ? {} : { reasoningTokens: count(completionDetails.reasoning_tokens) }),
  }
}

function failureOf(error: unknown, apiKey: string, aborted: boolean): LlmError {
  if (error instanceof LlmError) return error
  const message = (error instanceof Error ? error.message : 'Provider request failed').split(apiKey || '\u0000').join('[REDACTED]')
  const status = error instanceof OpenAI.APIError ? error.status : undefined
  const code = aborted ? 'ABORTED'
    : isContextWindowExceededError(message) ? 'CONTEXT_WINDOW_EXCEEDED'
    : isQuotaExceededError(message) ? 'QUOTA'
    : status === 401 || status === 403 ? 'AUTH'
    : status === 429 ? 'RATE_LIMIT'
    : status !== undefined ? 'HTTP_ERROR' : 'NETWORK'
  const retry = error instanceof OpenAI.APIError ? error.headers?.get('retry-after') : null
  const retryMs = retry ? (/^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : NaN
  return new LlmError(`CodeBuddy: ${message}`, code, {
    status,
    ...(Number.isFinite(retryMs) && retryMs > 0 ? { providerRetryAfterMs: retryMs } : {}),
    ...(error instanceof OpenAI.APIError && error.requestID ? { requestId: ProviderRequestId(error.requestID) } : {}),
  })
}

export class CodeBuddyAdapter extends LlmAdapter {
  constructor(private readonly config: Options, private readonly connection: Connection) { super() }

  override providerInfo(provider: string) { return { id: provider, name: 'CodeBuddy API' } }

  override async listModels(provider: string) {
    await this.connection.catalog?.refresh()
    return (this.connection.catalog?.models() ?? this.config.models).map(model => ({ provider, id: model.id, name: model.name || model.id, inputModalities: ['text' as const] }))
  }

  private modelConfig(id: string): ModelConfig {
    return (this.connection.catalog?.models() ?? this.config.models).find(model => model.id === id) ?? { id }
  }

  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const config = this.modelConfig(model)
    return {
      provider, id: model, name: config.name || model, inputModalities: ['text'],
      ...(config.contextWindow ? { context: { contextWindow: config.contextWindow } } : {}),
      ...(config.maxTokens ? { defaultMaxTokens: config.maxTokens } : {}),
      ...(config.reasoningEfforts?.length ? { reasoning: {
        efforts: config.reasoningEfforts.map(id => ({ id: ReasoningEffortId(id), name: id })),
      } } : {}),
    }
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    options.signal?.throwIfAborted()
    const apiKey = await this.connection.resolveApiKey()
    options.signal?.throwIfAborted()
    const deadline = AbortSignal.timeout(this.config.timeoutMs)
    const requestSignal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline
    const client = new OpenAI({
      apiKey, baseURL: this.connection.baseURL, timeout: this.config.timeoutMs,
      // dsh owns request retries; retrying inside the SDK would duplicate them.
      maxRetries: 0, ...(this.connection.fetch ? { fetch: this.connection.fetch } : {}),
    })
    const effort = options.reasoningEffort
    const model = this.modelConfig(options.model)
    if (effort && !model.reasoningEfforts?.includes(effort)) {
      throw new LlmError(`CodeBuddy: configure reasoningEfforts for ${options.model} before selecting ${effort}.`, 'UNSUPPORTED_REASONING_EFFORT')
    }
    const body: ChatCompletionCreateParamsStreaming = {
      model: options.model, messages: toMessages(options), stream: true,
      ...(this.config.includeUsage ? { stream_options: { include_usage: true } } : {}),
      ...(options.tools?.length ? { tools: options.tools.map(tool => ({
        type: 'function' as const, function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      })) } : {}),
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(options.maxTokens === undefined && model.maxTokens === undefined ? {} : { max_tokens: options.maxTokens ?? model.maxTokens }),
      ...(options.stop?.length ? { stop: options.stop } : {}),
      ...(effort ? { reasoning_effort: effort as NonNullable<ChatCompletionCreateParamsStreaming['reasoning_effort']> } : {}),
    }
    let stream: Awaited<ReturnType<typeof client.chat.completions.create>> | undefined
    const blocks: BlockState[] = []
    const tools = new Map<number, BlockState>()
    let current: BlockState | undefined
    let finish: string | null = null
    let usage: TokenUsage | undefined
    try {
      const response = await client.chat.completions.create(body, {
        // The official CLI supplies both headers for API-key authentication.
        signal: requestSignal, headers: { 'X-API-Key': apiKey, ...attributionHeaders() },
      })
      stream = response
      for await (const chunk of response) {
        requestSignal.throwIfAborted()
        if (chunk.usage) usage = usageOf(chunk.usage as unknown as Record<string, unknown>)
        const choice = chunk.choices.find(item => item.index === 0)
        if (!choice) continue
        if (choice.finish_reason) finish = choice.finish_reason
        const delta = choice.delta as typeof choice.delta & { reasoning_content?: string; reasoning?: string }
        for (const [type, text] of [['reasoning', delta.reasoning_content ?? delta.reasoning], ['text', delta.content]] as const) {
          if (!text) continue
          if (current?.type !== type) {
            current = { index: blocks.length, type, text: '', name: '' }
            blocks.push(current)
            yield { type: 'block-start', index: current.index, blockType: type }
          }
          current.text += text
          yield { type: type === 'text' ? 'text-delta' : 'reasoning-delta', index: current.index, text }
        }
        for (const tool of delta.tool_calls ?? []) {
          current = undefined
          let state = tools.get(tool.index)
          if (!state) {
            state = { index: blocks.length, type: 'tool-call', text: '', name: '' }
            tools.set(tool.index, state)
            blocks.push(state)
            yield { type: 'block-start', index: state.index, blockType: 'tool-call' }
          }
          if (tool.id) {
            if (state.id && state.id !== tool.id) throw new LlmError('CodeBuddy: tool-call ID changed during streaming.', 'INVALID_RESPONSE')
            state.id = tool.id
          }
          if (tool.function?.name) state.name += tool.function.name
          const argument = tool.function?.arguments ?? ''
          state.text += argument
          // Some endpoints omit id/name until a later chunk. Buffer until
          // the provider has supplied the real correlation id.
          if (state.id) {
            const pending = state.text.slice(state.emitted ?? 0)
            yield { type: 'tool-call-delta', index: state.index, id: ToolCallId(state.id), name: state.name || undefined, argumentsDelta: pending }
            state.emitted = state.text.length
          }
        }
      }
      requestSignal.throwIfAborted()
      if (!finish) throw new LlmError('CodeBuddy: stream ended before a finish_reason was received.', 'INCOMPLETE_RESPONSE')
      if (!blocks.length) throw new LlmError('CodeBuddy: response contains no content.', 'EMPTY_RESPONSE')
      for (const state of blocks) {
        let block: ContentBlock
        if (state.type === 'tool-call') {
          if (!state.id || !state.name) throw new LlmError('CodeBuddy: incomplete tool-call identity.', 'INVALID_RESPONSE')
          block = { type: 'tool-call', id: ToolCallId(state.id), name: state.name, arguments: state.text }
        } else block = { type: state.type, text: state.text }
        yield { type: 'block-end', index: state.index, block }
      }
      if (usage) yield { type: 'usage', usage }
      if (finish === 'content_filter') throw new LlmError('CodeBuddy: provider filtered this response.', 'CONTENT_FILTER')
      yield { type: 'finish', reason: { kind: finish === 'length' ? 'max-tokens' : tools.size || finish === 'tool_calls' ? 'tool-calls' : 'stop' } }
    } catch (error) {
      if (deadline.aborted && !options.signal?.aborted) throw new LlmError('CodeBuddy: request exceeded timeoutMs.', 'TIMEOUT')
      throw failureOf(error, apiKey, options.signal?.aborted ?? false)
    } finally {
      if (stream && 'controller' in stream) stream.controller.abort()
    }
  }
}
