import OpenAI from 'openai';
import { LlmAdapter, LlmError, ToolCallId, ReasoningEffortId, ProviderRequestId, attributionHeaders, isContextWindowExceededError, isQuotaExceededError } from '@deepseek-ai/dsh-llm';
import { BASE_URL } from './config.js';
import { object } from './session.js';
import { toInput, toolNames } from './messages.js';
function usageOf(value) {
    const raw = object(value);
    const count = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    const input = count(raw.input_tokens), output = count(raw.output_tokens);
    const cache = Math.min(input, count(object(raw.input_tokens_details).cached_tokens));
    return { inputTokens: input - cache, outputTokens: output, totalTokens: input + output,
        ...(cache ? { cacheReadTokens: cache } : {}),
        ...(object(raw.output_tokens_details).reasoning_tokens === undefined ? {} : { reasoningTokens: count(object(raw.output_tokens_details).reasoning_tokens) }),
    };
}
function failureOf(error, auth) {
    if (error instanceof LlmError)
        return error;
    let message = error instanceof Error ? error.message : '模型请求失败。';
    for (const secret of [auth?.apiKey, ...Object.values(auth?.headers ?? {})])
        if (secret)
            message = message.split(secret).join('[REDACTED]');
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    const code = isContextWindowExceededError(message) ? 'CONTEXT_WINDOW_EXCEEDED'
        : isQuotaExceededError(message) ? 'QUOTA'
            : status === 401 || status === 403 ? 'AUTH' : status === 429 ? 'RATE_LIMIT' : status ? 'HTTP_ERROR' : 'NETWORK';
    const retry = error instanceof OpenAI.APIError ? error.headers?.get('retry-after') : undefined;
    const retryMs = retry ? (/^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : NaN;
    return new LlmError(`Codex: ${message}`, code, { status,
        ...(Number.isFinite(retryMs) && retryMs > 0 ? { providerRetryAfterMs: retryMs } : {}),
        ...(error instanceof OpenAI.APIError && error.requestID ? { requestId: ProviderRequestId(error.requestID) } : {}),
    });
}
export class CodexAdapter extends LlmAdapter {
    config;
    connection;
    constructor(config, connection) {
        super();
        this.config = config;
        this.connection = connection;
    }
    providerInfo(provider) { return { id: provider, name: 'Codex' }; }
    async listModels(provider) {
        await this.connection.catalog.ready();
        return this.connection.catalog.models().map(model => ({ provider, id: model.id, name: model.name, inputModalities: model.inputModalities }));
    }
    async resolveModel(provider, id) {
        await this.connection.catalog.ready();
        const model = this.connection.catalog.models().find(model => model.id === id);
        if (!model)
            throw new LlmError(`Codex: 模型 ${id} 不在目录中，请刷新 Codex 组件。`, 'MODEL_NOT_FOUND');
        return { provider, id, name: model.name, inputModalities: model.inputModalities,
            ...(model.contextWindow ? { context: { contextWindow: model.contextWindow } } : {}),
            ...(model.reasoningEfforts.length ? { reasoning: {
                    efforts: model.reasoningEfforts.map(id => ({ id: ReasoningEffortId(id), name: id })),
                    ...(model.defaultReasoningEffort ? { defaultEffort: ReasoningEffortId(model.defaultReasoningEffort) } : {}),
                } } : {}),
        };
    }
    async *stream(options) {
        const deadline = AbortSignal.timeout(this.config.timeoutMs);
        const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
        let auth;
        let stream;
        try {
            signal.throwIfAborted();
            auth = await this.connection.authenticate(signal);
            const model = this.connection.catalog.models().find(model => model.id === options.model);
            if (options.reasoningEffort && !model?.reasoningEfforts.includes(options.reasoningEffort)) {
                throw new LlmError(`Codex: ${options.model} 不支持思考强度 ${options.reasoningEffort}。`, 'UNSUPPORTED_REASONING_EFFORT');
            }
            if (options.stop?.length)
                throw new LlmError('Codex Responses 不支持 stop 参数。', 'UNSUPPORTED_PARAMETER');
            const images = new Map();
            for (const message of options.messages)
                for (const block of message.content) {
                    if (block.type !== 'image' || block.offloaded || !this.connection.resolveImage)
                        continue;
                    const id = String(block.attachment.attachmentId);
                    if (images.has(id))
                        continue;
                    try {
                        signal.throwIfAborted();
                        images.set(id, await this.connection.resolveImage(block.attachment, signal));
                    }
                    catch (error) {
                        if (signal.aborted)
                            throw error;
                    }
                }
            const names = toolNames(options);
            // ChatGPT's Codex route requires streaming, a complete history and store:false.
            // It rejects temperature/max_output_tokens, so those DSH hints are omitted.
            const body = {
                model: options.model, instructions: options.system ?? '', input: toInput(options, names, images),
                stream: true, store: false, include: ['reasoning.encrypted_content'],
                tools: (options.tools ?? []).map(tool => ({ type: 'function', name: names.toWire.get(tool.name),
                    description: tool.description, parameters: tool.parameters, strict: false })),
                ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort, summary: 'auto' } } : {}),
                ...(options.sessionId ? { prompt_cache_key: String(options.sessionId) } : {}),
            };
            const client = new OpenAI({ apiKey: auth.apiKey, baseURL: this.connection.baseURL ?? BASE_URL,
                maxRetries: 0, timeout: this.config.timeoutMs, ...(this.connection.fetch ? { fetch: this.connection.fetch } : {}) });
            stream = await client.responses.create(body, { signal, headers: { ...attributionHeaders(), ...auth.headers, originator: 'dsh_provider' } });
            const states = [];
            const byKey = new Map();
            const queue = [];
            const stateFor = (itemId, type, part = 0) => {
                const key = `${itemId}:${type}:${part}`;
                let state = byKey.get(key);
                if (!state) {
                    state = { index: states.length, itemId, type, text: '' };
                    byKey.set(key, state);
                    states.push(state);
                    queue.push({ type: 'block-start', index: state.index, blockType: type });
                }
                return state;
            };
            const append = (state, text) => {
                if (!text)
                    return;
                state.text += text;
                if (state.type === 'tool-call') {
                    if (!state.callId || !state.name)
                        throw new LlmError('Codex: 工具调用缺少标识。', 'INVALID_RESPONSE');
                    queue.push({ type: 'tool-call-delta', index: state.index, id: ToolCallId(state.callId), name: state.name, argumentsDelta: text });
                }
                else
                    queue.push({ type: state.type === 'text' ? 'text-delta' : 'reasoning-delta', index: state.index, text });
            };
            const reconcile = (state, text) => {
                if (typeof text !== 'string')
                    return;
                if (!text.startsWith(state.text))
                    throw new LlmError('Codex: 流式内容与最终回复不一致。', 'INVALID_RESPONSE');
                append(state, text.slice(state.text.length));
            };
            const completeItem = (value) => {
                const item = object(value);
                if (typeof item.id !== 'string')
                    return;
                if (item.type === 'function_call') {
                    const state = stateFor(item.id, 'tool-call');
                    state.callId = typeof item.call_id === 'string' ? item.call_id : state.callId;
                    state.name = typeof item.name === 'string' ? names.fromWire.get(item.name) ?? item.name : state.name;
                    reconcile(state, item.arguments);
                }
                else if (item.type === 'reasoning') {
                    const state = stateFor(item.id, 'reasoning');
                    state.reasoning = item;
                    const summary = Array.isArray(item.summary) ? item.summary.map(part => object(part).text).filter(text => typeof text === 'string').join('\n') : '';
                    reconcile(state, summary);
                }
                else if (item.type === 'message' && Array.isArray(item.content)) {
                    item.content.forEach((part, index) => {
                        const content = object(part);
                        if (content.type === 'refusal')
                            throw new LlmError('Codex: 模型拒绝了此请求。', 'CONTENT_FILTER');
                        if (content.type === 'output_text')
                            reconcile(stateFor(item.id, 'text', index), content.text);
                    });
                }
            };
            let terminal;
            for await (const value of stream) {
                const event = object(value);
                if (event.type === 'response.output_item.added') {
                    const item = object(event.item);
                    if (typeof item.id === 'string' && item.type === 'function_call') {
                        const state = stateFor(item.id, 'tool-call');
                        state.callId = typeof item.call_id === 'string' ? item.call_id : undefined;
                        state.name = typeof item.name === 'string' ? names.fromWire.get(item.name) ?? item.name : undefined;
                    }
                    else if (typeof item.id === 'string' && item.type === 'reasoning')
                        stateFor(item.id, 'reasoning');
                }
                else if (typeof event.item_id === 'string' && typeof event.delta === 'string') {
                    if (event.type === 'response.output_text.delta')
                        append(stateFor(event.item_id, 'text', Number(event.content_index) || 0), event.delta);
                    else if (event.type === 'response.function_call_arguments.delta')
                        append(stateFor(event.item_id, 'tool-call'), event.delta);
                    else if (event.type === 'response.reasoning_summary_text.delta') {
                        const state = stateFor(event.item_id, 'reasoning');
                        append(state, event.delta);
                    }
                    else if (event.type === 'response.refusal.delta')
                        throw new LlmError('Codex: 模型拒绝了此请求。', 'CONTENT_FILTER');
                }
                else if (event.type === 'response.reasoning_summary_part.added' && Number(event.summary_index) > 0 && typeof event.item_id === 'string') {
                    append(stateFor(event.item_id, 'reasoning'), '\n');
                }
                else if (event.type === 'response.output_item.done')
                    completeItem(event.item);
                else if (event.type === 'response.completed' || event.type === 'response.incomplete') {
                    terminal = object(event.response);
                    if (Array.isArray(terminal.output))
                        terminal.output.forEach(completeItem);
                }
                else if (event.type === 'response.failed' || event.type === 'error') {
                    const error = object(object(event.response).error);
                    // Keep provider envelopes out of diagnostics; they may echo credentials or input.
                    const code = String(error.code ?? event.code ?? '');
                    throw new LlmError('Codex: 模型请求失败。', /usage_limit|quota/.test(code) ? 'QUOTA' : /rate_limit/.test(code) ? 'RATE_LIMIT'
                        : /context_length|context_window/.test(code) ? 'CONTEXT_WINDOW_EXCEEDED' : 'PROVIDER_ERROR');
                }
                while (queue.length)
                    yield queue.shift();
                if (terminal)
                    break;
            }
            if (!terminal)
                throw new LlmError('Codex: 回复流在完成前中断。', 'INCOMPLETE_RESPONSE');
            const incomplete = terminal.status === 'incomplete';
            if (incomplete && object(terminal.incomplete_details).reason !== 'max_output_tokens') {
                throw new LlmError('Codex: 模型未完成回复。', 'INCOMPLETE_RESPONSE');
            }
            if (!incomplete && terminal.status !== 'completed')
                throw new LlmError('Codex: 回复状态无效。', 'INVALID_RESPONSE');
            if (!states.some(state => state.type === 'tool-call' || state.type === 'text' && state.text)) {
                throw new LlmError('Codex: 模型没有返回内容。', 'EMPTY_RESPONSE');
            }
            for (const state of states) {
                if (state.type === 'tool-call') {
                    if (!state.callId || !state.name)
                        throw new LlmError('Codex: 工具调用缺少标识。', 'INVALID_RESPONSE');
                    yield { type: 'block-end', index: state.index, block: { type: 'tool-call', id: ToolCallId(state.callId), name: state.name, arguments: state.text } };
                }
                else
                    yield { type: 'block-end', index: state.index, block: { type: state.type, text: state.text } };
            }
            if (terminal.usage)
                yield { type: 'usage', usage: usageOf(terminal.usage) };
            yield { type: 'finish', reason: { kind: incomplete ? 'max-tokens' : states.some(state => state.type === 'tool-call') ? 'tool-calls' : 'stop' },
                replayState: { response: { format: 'codex-responses-v1' }, blocks: states.map(state => state.reasoning ? { reasoning: state.reasoning } : {}) },
            };
        }
        catch (error) {
            if (options.signal?.aborted)
                throw new LlmError('Codex: 请求已取消。', 'ABORTED');
            if (deadline.aborted)
                throw new LlmError('Codex: 请求超时。', 'TIMEOUT');
            throw failureOf(error, auth);
        }
        finally {
            if (stream && 'controller' in stream)
                stream.controller.abort();
        }
    }
}
//# sourceMappingURL=adapter.js.map