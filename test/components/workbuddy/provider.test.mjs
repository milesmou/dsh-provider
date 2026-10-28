import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime, BlockAssembler, attributionHeaders, createAssistantMessage, createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { CodeBuddyAdapter } from '../../../lib/components/workbuddy/adapter.js'
import { Config, resolveBaseURL, validateModels } from '../../../lib/components/workbuddy/config.js'
import { toMessages } from '../../../lib/components/workbuddy/messages.js'
import * as plugin from '../../../lib/index.js'

const config = (values = {}) => Config(values)
const request = (values = {}) => ({ provider: 'workbuddy', model: 'auto', messages: [{ role: 'user', content: [{ type: 'text', text: '你好' }] }], ...values })
const chunk = (delta, finish_reason = null) => ({ id: 'chat-1', object: 'chat.completion.chunk', created: 1, model: 'auto', choices: [{ index: 0, delta, finish_reason }] })
const sse = (...chunks) => chunks.map(value => `data: ${JSON.stringify(value)}\n\n`).join('') + 'data: [DONE]\n\n'

async function fixture(t, handler, options = {}) {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  return new CodeBuddyAdapter(config(options), {
    baseURL: `http://127.0.0.1:${server.address().port}/v2`,
    resolveApiKey: async () => 'ck_test-only-secret',
  })
}

async function collect(adapter, options = {}) {
  const assembler = new BlockAssembler()
  const chunks = []
  for await (const value of adapter.stream(request(options))) { chunks.push(value); assembler.push(value) }
  return { chunks, blocks: assembler.blocks(), usage: assembler.usage, finish: assembler.finish }
}

test('Codeg region defaults and custom endpoint precedence', () => {
  assert.equal(resolveBaseURL(config(), () => undefined), 'https://copilot.tencent.com/v2')
  assert.equal(resolveBaseURL(config({ environment: 'overseas' }), () => undefined), 'https://www.codebuddy.ai/v2')
  const env = { CODEBUDDY_BASE_URL: 'https://gateway.example/v1/chat/completions/', CODEBUDDY_INTERNET_ENVIRONMENT: 'ioa' }
  assert.equal(resolveBaseURL(config(), key => env[key]), 'https://gateway.example/v1')
  assert.equal(resolveBaseURL(config({ baseURL: 'https://custom.example' }), () => undefined), 'https://custom.example/v2')
  for (const baseURL of ['file:///tmp/test', 'https://user:password@example.com', 'https://host/v2?key=secret']) {
    assert.throws(() => resolveBaseURL(config({ baseURL }), () => undefined))
  }
  assert.throws(() => resolveBaseURL(config({ environment: 'ioa' }), () => undefined), /iOA/)
  assert.throws(() => validateModels([{ id: 'a' }, { id: 'a' }]), /unique/)
})

test('wire request and fragmented UTF-8 stream preserve text, reasoning, attribution and cache usage', async t => {
  let captured
  const adapter = await fixture(t, async (req, res) => {
    let data = ''
    for await (const part of req) data += part
    captured = { path: req.url, headers: req.headers, body: JSON.parse(data) }
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const dataBytes = Buffer.from(sse(
      chunk({ reasoning_content: '想一想' }), chunk({ content: '你' }), chunk({ content: '好' }, 'stop'),
      { choices: [], usage: { prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 60 } },
    ))
    // Split multibyte Chinese characters and SSE frame boundaries.
    for (let index = 0; index < dataBytes.length; index += 7) res.write(dataBytes.subarray(index, index + 7))
    res.end()
  })
  const result = await collect(adapter, { system: '你是助手', maxTokens: 512, tools: [{ name: 'read_file', description: 'Read file', parameters: { type: 'object' } }] })
  assert.equal(captured.path, '/v2/chat/completions')
  assert.equal(captured.headers.authorization, 'Bearer ck_test-only-secret')
  assert.equal(captured.headers['x-api-key'], 'ck_test-only-secret')
  assert.equal(captured.headers['user-agent'], attributionHeaders()['user-agent'])
  assert.equal(captured.body.max_tokens, 512)
  assert.equal(captured.body.messages[0].role, 'system')
  assert.equal(captured.body.tools[0].function.name, 'read_file')
  assert.deepEqual(result.blocks, [{ type: 'reasoning', text: '想一想' }, { type: 'text', text: '你好' }])
  assert.deepEqual(result.usage, { inputTokens: 40, outputTokens: 20, cacheReadTokens: 60, totalTokens: 120 })
  assert.equal(result.chunks.at(-1).type, 'finish')
})

test('interleaved tool argument fragments and delayed IDs retain exact raw JSON', async t => {
  const adapter = await fixture(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end(sse(
      chunk({ tool_calls: [{ index: 0, function: { arguments: '{"path":' } }, { index: 1, id: 'call_b', function: { name: 'list', arguments: '{' } }] }),
      chunk({ tool_calls: [{ index: 0, id: 'call_a', function: { name: 'read', arguments: '"a.ts"}' } }, { index: 1, function: { arguments: '}' } }] }),
      chunk({}, 'tool_calls'),
    ))
  })
  const result = await collect(adapter)
  assert.deepEqual(result.blocks, [
    { type: 'tool-call', id: 'call_a', name: 'read', arguments: '{"path":"a.ts"}' },
    { type: 'tool-call', id: 'call_b', name: 'list', arguments: '{}' },
  ])
  assert.equal(result.finish.kind, 'tool-calls')
  const deltas = result.chunks.filter(value => value.type === 'tool-call-delta' && value.id === 'call_a')
  assert.equal(deltas.map(value => value.argumentsDelta).join(''), '{"path":"a.ts"}')
})

test('assistant reasoning and real tool correlation ID survive a subsequent request', () => {
  const assistant = createAssistantMessage({ source: { provider: 'workbuddy', model: 'auto' }, content: [
    { type: 'reasoning', text: 'inspect' }, { type: 'tool-call', id: ToolCallId('call_a'), name: 'read', arguments: '{}' },
  ] })
  const tool = createToolResultMessage({ callId: ToolCallId('call_a'), content: [{ type: 'text', text: 'result' }], isError: false })
  const messages = toMessages(request({ messages: [assistant, tool] }))
  assert.equal(messages[0].reasoning_content, 'inspect')
  assert.equal(messages[0].tool_calls[0].id, 'call_a')
  assert.deepEqual(messages[1], { role: 'tool', tool_call_id: 'call_a', content: 'result' })
})

test('HTTP 401 redacts key; 429 preserves retry-after; SDK does not retry', async t => {
  for (const status of [401, 429]) {
    let count = 0
    const adapter = await fixture(t, (_req, res) => {
      count++
      res.writeHead(status, { 'content-type': 'application/json', 'retry-after': '2' })
      res.end(JSON.stringify({ error: { message: 'rejected ck_test-only-secret', type: 'provider_error' } }))
    })
    await assert.rejects(() => collect(adapter), error => {
      assert.equal(error.code, status === 401 ? 'AUTH' : 'RATE_LIMIT')
      assert.equal(error.failure.status, status)
      assert.equal(error.failure.providerRetryAfterMs, 2000)
      assert.ok(!error.message.includes('ck_test-only-secret'))
      return true
    })
    assert.equal(count, 1)
  }
})

test('truncated streams fail instead of silently finishing', async t => {
  const adapter = await fixture(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end(sse(chunk({ content: 'partial' })))
  })
  await assert.rejects(() => collect(adapter), { code: 'INCOMPLETE_RESPONSE' })
})

test('cancellation and deadline abort an idle stream', async t => {
  for (const cancel of [true, false]) {
    const adapter = await fixture(t, (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write(`data: ${JSON.stringify(chunk({ content: 'prefix' }))}\n\n`)
    }, { timeoutMs: cancel ? 3000 : 150 })
    const controller = new AbortController()
    if (cancel) setTimeout(() => controller.abort(), 100)
    await assert.rejects(() => collect(adapter, { signal: controller.signal }), { code: cancel ? 'ABORTED' : 'TIMEOUT' })
  }
})

test('unsupported image input is rejected before any request', async () => {
  const adapter = new CodeBuddyAdapter(config(), { baseURL: 'http://127.0.0.1:1/v2', resolveApiKey: async () => 'test' })
  await assert.rejects(() => collect(adapter, { messages: [{ role: 'user', content: [{ type: 'image', attachment: {} }] }] }), { code: 'UNSUPPORTED_CONTENT' })
})

test('actual Cordis lifecycle registers models and disposes the provider', async () => {
  const ctx = new Context()
  ctx.provide('launchEnvironment')
  ctx.set('launchEnvironment', createLaunchEnvironmentSnapshot([{ source: 'process', values: {} }]))
  const llmFiber = ctx.plugin(LlmRuntime)
  const fiber = ctx.plugin(plugin, { workbuddy: { models: [{ id: 'glm-4.7', name: 'GLM-4.7', contextWindow: 200000, maxTokens: 4096 }] } })
  await llmFiber.await()
  await fiber.await()
  try {
    assert.ok(ctx.llm.listProviders().some(provider => provider.id === 'workbuddy'))
    assert.equal((await ctx.llm.listModels('workbuddy'))[0].id, 'glm-4.7')
    const model = await ctx.llm.resolveModelInfo('workbuddy', 'glm-4.7')
    assert.equal(model.context.contextWindow, 200000)
    const chunks = []
    for await (const value of ctx.llm.stream(request({ model: 'glm-4.7' }))) chunks.push(value)
    assert.equal(chunks.at(-1).reason.failure.code, 'MISSING_CREDENTIAL')
    await fiber.dispose()
    assert.ok(!ctx.llm.listProviders().some(provider => provider.id === 'workbuddy'))
  } finally { await ctx.fiber.dispose() }
})
