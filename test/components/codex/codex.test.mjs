import '../../../harness-setup.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { BlockAssembler, createAssistantMessage, createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { Config } from '../../../lib/components/codex/config.js'
import { CodexSession, resolveCodexHome } from '../../../lib/components/codex/session.js'
import { CodexCatalog, parseCatalog } from '../../../lib/components/codex/catalog.js'
import { CodexAdapter } from '../../../lib/components/codex/adapter.js'
import { toInput, toolNames } from '../../../lib/components/codex/messages.js'

const jwt = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
const auth = { apiKey: 'codex-test-secret', headers: { 'ChatGPT-Account-Id': 'test-account' } }
const rawModel = { slug: 'test-codex', display_name: 'Test Codex', visibility: 'list', context_window: 200000,
  effective_context_window_percent: 95, input_modalities: ['text', 'image'], default_reasoning_level: 'medium',
  supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }, { effort: 'high' }] }
const models = parseCatalog({ models: [rawModel] })
const request = (extra = {}) => ({ provider: 'codex', model: 'test-codex', messages: [{ role: 'user', content: [{ type: 'text', text: '你好' }] }], ...extra })
const event = (type, data = {}) => ({ type, ...data })
const message = (text = '你好') => ({ type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] })
const completed = (output = [message()], extra = {}) => event('response.completed', { response: { id: 'resp_1', status: 'completed', output, ...extra } })
const wire = events => events.map(value => `event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`).join('')

async function home(t) {
  const path = await mkdtemp(join(tmpdir(), 'dsh-codex-'))
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}
async function server(t, handler) {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  return `http://127.0.0.1:${server.address().port}`
}
async function fixture(t, handler, options = {}, connection = {}) {
  const baseURL = await server(t, handler)
  return new CodexAdapter(Config(options), { authenticate: async () => auth,
    catalog: { ready: async () => {}, models: () => models }, baseURL, ...connection })
}
async function collect(adapter, extra = {}) {
  const assembler = new BlockAssembler(), chunks = []
  for await (const chunk of adapter.stream(request(extra))) { chunks.push(chunk); assembler.push(chunk) }
  return { assembler, chunks, blocks: assembler.blocks(), finish: assembler.finish, usage: assembler.usage }
}
const respond = (res, events) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end(wire(events)) }

test('Codex home precedence and tilde expansion', () => {
  assert.equal(resolveCodexHome('', undefined), join(homedir(), '.codex'))
  assert.equal(resolveCodexHome('~/.other', 'ignored'), join(homedir(), '.other'))
  assert.equal(resolveCodexHome('', join(tmpdir(), 'from-env')), join(tmpdir(), 'from-env'))
  assert.equal(resolveCodexHome(join(tmpdir(), 'configured'), 'ignored'), join(tmpdir(), 'configured'))
})

test('local ChatGPT credentials are re-read and secrets never reach status', async t => {
  const path = await home(t), session = new CodexSession(path)
  assert.equal((await session.status()).configured, false)
  const file = join(path, 'auth.json')
  const access = jwt({ exp: Math.floor(Date.now() / 1000) + 3600, 'https://api.openai.com/auth': { chatgpt_account_id: 'claim-account' } })
  await writeFile(file, JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: access } }))
  assert.deepEqual(await session.authenticate(), { apiKey: access, headers: { 'ChatGPT-Account-Id': 'claim-account' } })
  assert.deepEqual(await session.status(), { configured: true })
  await writeFile(file, JSON.stringify({ tokens: { access_token: 'replacement', account_id: 'new-account' } }))
  assert.equal((await session.authenticate()).apiKey, 'replacement')
  assert.ok(!JSON.stringify(await session.status()).includes('replacement'))
  const controller = new AbortController(); controller.abort()
  await assert.rejects(() => session.authenticate(controller.signal), { name: 'AbortError' })
})

test('expired, malformed, missing and API-key credentials have actionable safe diagnostics', async t => {
  const path = await home(t), session = new CodexSession(path), file = join(path, 'auth.json')
  const values = ['{secret-invalid-json', JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: 'secret-key' }),
    JSON.stringify({ tokens: { access_token: 'secret-token' } }),
    JSON.stringify({ tokens: { access_token: jwt({ exp: 1 }), account_id: 'account' } })]
  for (const value of values) {
    await writeFile(file, value)
    const status = await session.status()
    assert.equal(status.configured, false)
    assert.match(status.issue, /codex login/)
    assert.ok(!status.issue.includes('secret'))
  }
})

test('catalog reads visibility, modalities, capacity and reasoning metadata without guessed models', () => {
  const result = parseCatalog({ models: [rawModel, { ...rawModel, slug: 'hidden', visibility: 'hide' },
    { ...rawModel, slug: 'text-only', input_modalities: ['text'] }] })
  assert.deepEqual(result.map(model => model.id), ['test-codex', 'text-only'])
  assert.equal(result[0].contextWindow, 190000)
  assert.deepEqual(result[0].reasoningEfforts, ['low', 'medium', 'high'])
  assert.equal(result[0].defaultReasoningEffort, 'medium')
  assert.deepEqual(result[1].inputModalities, ['text'])
  assert.throws(() => parseCatalog({ models: [] }))
})

test('catalog fetch is coalesced and retains cached models on failure', async t => {
  const path = await home(t)
  await writeFile(join(path, 'models_cache.json'), JSON.stringify({ client_version: '1.2.3', models: [rawModel] }))
  let calls = 0, fail = false
  const baseURL = await server(t, (req, res) => {
    calls++
    assert.equal(req.url, '/models?client_version=1.2.3')
    assert.equal(req.headers.authorization, `Bearer ${auth.apiKey}`)
    assert.equal(req.headers['chatgpt-account-id'], 'test-account')
    res.writeHead(fail ? 500 : 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ models: [{ ...rawModel, slug: 'live-model' }] }))
  })
  const catalog = new CodexCatalog({ home: path, authenticate: async () => auth }, () => {}, { baseURL })
  t.after(() => catalog.dispose())
  const first = catalog.refresh()
  assert.equal(catalog.refresh(), first)
  await first
  assert.equal(calls, 1)
  assert.equal(catalog.source, 'live')
  assert.equal(catalog.models()[0].id, 'live-model')
  fail = true
  await catalog.refresh()
  assert.equal(catalog.models()[0].id, 'live-model')
  assert.match(catalog.issue, /更新失败/)
  catalog.dispose()
  await catalog.refresh()
  assert.equal(calls, 2)
})

test('no login uses the existing cache without making a network request', async t => {
  const path = await home(t)
  await writeFile(join(path, 'models_cache.json'), JSON.stringify({ models: [rawModel] }))
  const catalog = new CodexCatalog(new CodexSession(path), () => {}, { fetch: () => assert.fail('Network must not run without login') })
  await catalog.refresh()
  assert.equal(catalog.source, 'cache')
  assert.equal(catalog.models()[0].id, 'test-codex')
  catalog.dispose()
})

test('wire request uses Responses, full history, valid function names and account headers', async t => {
  let captured
  const adapter = await fixture(t, async (req, res) => {
    let body = ''; for await (const part of req) body += part
    captured = { path: req.url, headers: req.headers, body: JSON.parse(body) }
    const bytes = Buffer.from(wire([
      event('response.output_text.delta', { item_id: 'msg_1', content_index: 0, delta: '你' }),
      event('response.output_text.delta', { item_id: 'msg_1', content_index: 0, delta: '好' }),
      completed([message()], { usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 60 }, output_tokens_details: { reasoning_tokens: 10 } } }),
    ]))
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    for (let index = 0; index < bytes.length; index += 7) res.write(bytes.subarray(index, index + 7))
    res.end()
  })
  const result = await collect(adapter, { system: 'Be helpful', reasoningEffort: 'high', maxTokens: 12, temperature: 0.1,
    tools: [{ name: 'files.read', description: 'Read', parameters: { type: 'object' } }],
    messages: [{ role: 'system', content: [{ type: 'text', text: 'System' }] }, { role: 'user', content: [{ type: 'text', text: 'Hello' }] }] })
  assert.equal(captured.path, '/responses')
  assert.equal(captured.headers.authorization, `Bearer ${auth.apiKey}`)
  assert.equal(captured.headers['chatgpt-account-id'], 'test-account')
  assert.equal(captured.body.store, false)
  assert.equal(captured.body.stream, true)
  assert.equal(captured.body.instructions, 'Be helpful')
  assert.equal(captured.body.input[0].role, 'developer')
  assert.equal(captured.body.tools[0].name, 'files_read')
  assert.equal(captured.body.tools[0].strict, false)
  assert.deepEqual(captured.body.reasoning, { effort: 'high', summary: 'auto' })
  assert.deepEqual(captured.body.include, ['reasoning.encrypted_content'])
  assert.equal(captured.body.max_output_tokens, undefined)
  assert.equal(captured.body.temperature, undefined)
  assert.deepEqual(result.blocks, [{ type: 'text', text: '你好' }])
  assert.deepEqual(result.usage, { inputTokens: 40, outputTokens: 20, cacheReadTokens: 60, reasoningTokens: 10, totalTokens: 120 })
  assert.equal(result.finish.kind, 'stop')
  assert.equal(result.chunks.at(-1).type, 'finish')
})

test('interleaved tool calls preserve argument bytes and encrypted reasoning replays with matching model only', async t => {
  const reasoning = { type: 'reasoning', id: 'rs_1', summary: [{ type: 'summary_text', text: 'Inspect' }], encrypted_content: 'encrypted-state' }
  const a = { type: 'function_call', id: 'fc_a', call_id: 'call_a', name: 'files_read', arguments: '{"path":"a.ts"}' }
  const b = { type: 'function_call', id: 'fc_b', call_id: 'call_b', name: 'list', arguments: '{}' }
  const adapter = await fixture(t, (_req, res) => respond(res, [
    event('response.output_item.added', { item: { ...reasoning, summary: [] } }),
    event('response.reasoning_summary_text.delta', { item_id: 'rs_1', summary_index: 0, delta: 'Inspect' }),
    event('response.output_item.added', { item: { ...a, arguments: '' } }),
    event('response.output_item.added', { item: { ...b, arguments: '' } }),
    event('response.function_call_arguments.delta', { item_id: 'fc_a', delta: '{"path":' }),
    event('response.function_call_arguments.delta', { item_id: 'fc_b', delta: '{}' }),
    event('response.function_call_arguments.delta', { item_id: 'fc_a', delta: '"a.ts"}' }),
    event('response.output_item.done', { item: a }), completed([reasoning, a, b]),
  ]))
  const tools = [{ name: 'files.read', description: '', parameters: {} }, { name: 'list', description: '', parameters: {} }]
  const result = await collect(adapter, { tools })
  assert.deepEqual(result.blocks, [{ type: 'reasoning', text: 'Inspect' },
    { type: 'tool-call', id: 'call_a', name: 'files.read', arguments: '{"path":"a.ts"}' },
    { type: 'tool-call', id: 'call_b', name: 'list', arguments: '{}' }])
  assert.equal(result.finish.kind, 'tool-calls')
  const assistant = createAssistantMessage({ content: result.blocks,
    source: { provider: 'codex', model: 'test-codex', replayState: result.assembler.replayState } })
  const tool = createToolResultMessage({ callId: ToolCallId('call_a'), content: [{ type: 'text', text: 'file contents' }] })
  const options = request({ messages: [assistant, tool], tools })
  const input = toInput(options, toolNames(options))
  assert.equal(input[0].encrypted_content, 'encrypted-state')
  assert.equal(input[1].call_id, 'call_a')
  assert.equal(input[1].name, 'files_read')
  assert.equal(input.at(-1).type, 'function_call_output')
  assert.equal(input.at(-1).call_id, 'call_a')
  assert.deepEqual(input.at(-1).output, [{ type: 'input_text', text: 'file contents' }])
  const other = { ...options, model: 'other-model' }
  assert.ok(!toInput(other, toolNames(other)).some(item => item.type === 'reasoning'))
})

test('final output without deltas and empty reasoning summaries are preserved', async t => {
  const reasoning = { type: 'reasoning', id: 'rs_empty', summary: [], encrypted_content: 'ciphertext' }
  const adapter = await fixture(t, (_req, res) => respond(res, [completed([reasoning, message()])]))
  const result = await collect(adapter)
  assert.deepEqual(result.blocks, [{ type: 'reasoning', text: '' }, { type: 'text', text: '你好' }])
  assert.equal(result.assembler.replayState.blocks[0].reasoning.encrypted_content, 'ciphertext')
})

test('multiple reasoning summaries stay separated and done events never duplicate text', async t => {
  const reasoning = { type: 'reasoning', id: 'rs_1', summary: [{ type: 'summary_text', text: 'First' }, { type: 'summary_text', text: 'Second' }] }
  const adapter = await fixture(t, (_req, res) => respond(res, [
    event('response.reasoning_summary_text.delta', { item_id: 'rs_1', summary_index: 0, delta: 'First' }),
    event('response.reasoning_summary_part.added', { item_id: 'rs_1', summary_index: 1 }),
    event('response.reasoning_summary_text.delta', { item_id: 'rs_1', summary_index: 1, delta: 'Second' }),
    event('response.output_item.done', { item: reasoning }), completed([reasoning, message()]),
  ]))
  assert.equal((await collect(adapter)).blocks[0].text, 'First\nSecond')
})

test('tool name replacements avoid collisions and respect Responses length constraints', () => {
  const options = request({ tools: ['a.b', 'a_b', 'a/b', 'long.'.repeat(20)].map(name => ({ name, description: '', parameters: {} })) })
  const names = toolNames(options)
  assert.equal(new Set(names.toWire.values()).size, 4)
  assert.equal(names.toWire.get('a_b'), 'a_b')
  for (const [original, wire] of names.toWire) {
    assert.match(wire, /^[A-Za-z0-9_-]{1,64}$/)
    assert.equal(names.fromWire.get(wire), original)
  }
})

test('images and tool result images use input_image or a text placeholder', async t => {
  const image = { type: 'image', attachment: { attachmentId: 'sha256:abcdef0123456789', mediaType: 'image/png', width: 4, height: 4, bytes: 88 } }
  let captured
  const adapter = await fixture(t, async (req, res) => {
    let body = ''; for await (const part of req) body += part
    captured = JSON.parse(body)
    respond(res, [completed()])
  }, {}, { resolveImage: async () => 'data:image/png;base64,iVBORw0KGgo=' })
  const messages = [{ role: 'user', content: [image] }, createToolResultMessage({ callId: ToolCallId('call_a'), content: [image] })]
  await collect(adapter, { messages })
  assert.equal(captured.input[0].content[0].type, 'input_image')
  assert.equal(captured.input[1].output[0].image_url, 'data:image/png;base64,iVBORw0KGgo=')
  const options = request({ messages })
  assert.match(toInput(options, toolNames(options))[0].content[0].text, /image omitted/)
})

test('truncated streams, failed terminal events and inconsistent final content fail explicitly', async t => {
  for (const [events, code] of [
    [[event('response.output_text.delta', { item_id: 'msg_1', delta: 'partial' })], 'INCOMPLETE_RESPONSE'],
    [[event('response.failed', { response: { error: { code: 'usage_limit_reached', message: auth.apiKey } } })], 'QUOTA'],
    [[event('response.output_text.delta', { item_id: 'msg_1', delta: 'wrong' }), completed()], 'INVALID_RESPONSE'],
    [[event('response.incomplete', { response: { status: 'incomplete', output: [], incomplete_details: { reason: 'content_filter' } } })], 'INCOMPLETE_RESPONSE'],
  ]) {
    const adapter = await fixture(t, (_req, res) => respond(res, events))
    await assert.rejects(() => collect(adapter), error => { assert.equal(error.code, code); assert.ok(!error.message.includes(auth.apiKey)); return true })
  }
})

test('HTTP errors redact credentials, preserve retry-after and never retry internally', async t => {
  for (const status of [401, 429]) {
    let calls = 0
    const adapter = await fixture(t, (_req, res) => {
      calls++
      res.writeHead(status, { 'content-type': 'application/json', 'retry-after': '2', 'x-request-id': 'req_test' })
      res.end(JSON.stringify({ error: { message: `Rejected ${auth.apiKey} test-account` } }))
    })
    await assert.rejects(() => collect(adapter), error => {
      assert.equal(error.code, status === 401 ? 'AUTH' : 'RATE_LIMIT')
      assert.equal(error.failure.providerRetryAfterMs, 2000)
      assert.equal(error.failure.requestId, 'req_test')
      assert.ok(!error.message.includes(auth.apiKey)); assert.ok(!error.message.includes('test-account'))
      return true
    })
    assert.equal(calls, 1)
  }
})

test('cancellation, early abort and timeout stop idle streams', async t => {
  for (const cancel of [true, false]) {
    const adapter = await fixture(t, (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write(wire([event('response.output_text.delta', { item_id: 'msg_1', delta: 'prefix' })]))
    }, { timeoutMs: cancel ? 3000 : 100 })
    const controller = new AbortController()
    if (cancel) setTimeout(() => controller.abort(), 60)
    await assert.rejects(() => collect(adapter, { signal: controller.signal }), { code: cancel ? 'ABORTED' : 'TIMEOUT' })
  }
  const adapter = await fixture(t, () => assert.fail('Request should not run'))
  const controller = new AbortController(); controller.abort()
  await assert.rejects(() => collect(adapter, { signal: controller.signal }), { code: 'ABORTED' })
})

test('model metadata, unsupported reasoning and stop hints are explicit', async t => {
  const adapter = await fixture(t, () => assert.fail('No HTTP request expected'))
  const model = await adapter.resolveModel('codex', 'test-codex')
  assert.equal(model.context.contextWindow, 190000)
  assert.equal(model.reasoning.defaultEffort, 'medium')
  assert.equal((await adapter.listModels('codex'))[0].name, 'Test Codex')
  await assert.rejects(() => adapter.resolveModel('codex', 'missing'), { code: 'MODEL_NOT_FOUND' })
  await assert.rejects(() => collect(adapter, { reasoningEffort: 'ultra' }), { code: 'UNSUPPORTED_REASONING_EFFORT' })
  await assert.rejects(() => collect(adapter, { stop: ['stop'] }), { code: 'UNSUPPORTED_PARAMETER' })
})
