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
import { workbuddyRequest } from './workbuddy-request.js'
import { AFTER_TOOLS_REFUSED, clientChatHeaders, replyAfterToolResults, systemAsUser } from './shaping.js'
import type { LooseBody } from './shaping.js'

export interface Connection {
  baseURL: string
  resolveApiKey?: () => Promise<string>
  authenticate?: (signal?: AbortSignal) => Promise<{ apiKey: string; headers: Record<string, string> }>
  workbuddy?: boolean
  providerName?: string
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

/** WorkBuddy's 400 for a chat it reads as an unapproved channel. */
const CHANNEL_REFUSED = /unapproved channel|illegal api invocation/i

// The shaping helpers work on plain records; the OpenAI params type is narrower
// than the wire body it describes.
const loose = (body: ChatCompletionCreateParamsStreaming) => body as unknown as LooseBody
const strict = (body: LooseBody | null) => body as unknown as ChatCompletionCreateParamsStreaming | null

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
  if (!aborted && status === 400 && error instanceof OpenAI.APIError) {
    let data = error.error as Record<string, unknown> | undefined
    // Non-OpenAI envelopes are kept in the SDK message rather than .error.
    if (!data) {
      try { data = JSON.parse(message.replace(/^400\s+/, '')) } catch { /* Keep the normal HTTP error below. */ }
    }
    if (data && String(data.code) === '11128' && /unapproved channel/i.test(String(data.msg ?? data.message ?? ''))) {
      const id = error.requestID ?? data.requestId
      const requestId = typeof id === 'string' && /^[A-Za-z0-9_.-]{1,160}$/.test(id) && !id.includes(apiKey) ? id : undefined
      return new LlmError('WorkBuddy/CodeBuddy 拒绝了当前调用渠道（11128）：当前提示词未通过渠道校验；重复发送不能保证解决。请使用官方客户端，或改用已获授权的 API 接入。', 'CHANNEL_RESTRICTED', {
        status, ...(requestId ? { requestId: ProviderRequestId(requestId) } : {}),
      })
    }
  }
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
  /** System prompts WorkBuddy refused as an unapproved channel this run. */
  private readonly refusedSystems = new Set<string>()
  /** Models that refused tool results followed by the user's message this run. */
  private readonly endsAfterTools = new Set<string>()

  constructor(private readonly config: Options, private readonly connection: Connection) { super() }

  override providerInfo(provider: string) { return { id: provider, name: this.connection.providerName ?? 'CodeBuddy API' } }

  override async listModels(provider: string) {
    await this.connection.catalog?.ready()
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
    const auth = this.connection.authenticate ? await this.connection.authenticate(options.signal)
      : { apiKey: await this.connection.resolveApiKey!(), headers: {} }
    const apiKey = auth.apiKey
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
    let body: ChatCompletionCreateParamsStreaming = {
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
    const prepared = this.connection.workbuddy ? workbuddyRequest(body, options) : undefined
    if (prepared) body = prepared.body
    const headers = this.connection.workbuddy
      ? { ...auth.headers, ...clientChatHeaders(), ...(prepared?.headers ?? {}) }
      // The official CLI supplies both headers for API-key authentication.
      : { 'X-API-Key': apiKey, ...attributionHeaders() }
    const post = async (payload: ChatCompletionCreateParamsStreaming) =>
      client.chat.completions.create(payload, { signal: requestSignal, headers })
    // A refused system prompt and a refused reply-after-tools are body
    // corrections WorkBuddy asks for, not transport retries: each is applied
    // once and remembered for the rest of the run.
    const send = async (): Promise<Awaited<ReturnType<typeof post>>> => {
      let payload = body
      if (prepared?.systemKey && this.refusedSystems.has(prepared.systemKey)) {
        payload = strict(systemAsUser(loose(payload))) ?? payload
      }
      // A model known to turn tool results then the user's message away gets
      // the empty reply between them up front.
      if (prepared && this.endsAfterTools.has(options.model)) {
        payload = strict(replyAfterToolResults(loose(payload))) ?? payload
      }
      for (let attempt = 0; ; attempt++) {
        try {
          return await post(payload)
        } catch (error) {
          if (attempt >= 2 || requestSignal.aborted || !(error instanceof OpenAI.APIError) || error.status !== 400) throw error
          const said = error.message + (error.error === undefined ? ''
            : ' ' + (typeof error.error === 'string' ? error.error : JSON.stringify(error.error)))
          let next: ChatCompletionCreateParamsStreaming | null = null
          if (prepared?.systemKey && !this.refusedSystems.has(prepared.systemKey) && CHANNEL_REFUSED.test(said)) {
            next = strict(systemAsUser(loose(payload)))
            if (next) {
              this.refusedSystems.add(prepared.systemKey)
              if (this.refusedSystems.size > 256) this.refusedSystems.delete(this.refusedSystems.values().next().value!)
            }
          }
          if (!next && !this.endsAfterTools.has(options.model) && AFTER_TOOLS_REFUSED.test(said)) {
            next = strict(replyAfterToolResults(loose(payload)))
            if (next) this.endsAfterTools.add(options.model)
          }
          if (!next) throw error
          payload = next
        }
      }
    }
    let stream: Awaited<ReturnType<typeof client.chat.completions.create>> | undefined
    const blocks: BlockState[] = []
    const tools = new Map<number, BlockState>()
    let current: BlockState | undefined
    let finish: string | null = null
    let usage: TokenUsage | undefined
    try {
      const response = await send()
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
            yield { type: 'tool-call-delta', index: state.index, id: ToolCallId(state.id), name: (prepared?.names.get(state.name) ?? state.name) || undefined, argumentsDelta: pending }
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
          block = { type: 'tool-call', id: ToolCallId(state.id), name: prepared?.names.get(state.name) ?? state.name, arguments: state.text }
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
