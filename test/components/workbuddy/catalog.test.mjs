import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { ModelCatalog, catalogURL, parseCatalog } from '../../../lib/components/workbuddy/catalog.js'
import { CodeBuddyAdapter } from '../../../lib/components/workbuddy/adapter.js'
import { Config } from '../../../lib/components/workbuddy/config.js'
import * as plugin from '../../../lib/index.js'

test('official config and custom gateway catalog paths keep credentials on their own host', () => {
  assert.equal(catalogURL('https://copilot.tencent.com/v2'), 'https://copilot.tencent.com/v3/config')
  assert.equal(catalogURL('https://www.codebuddy.ai/v2'), 'https://www.codebuddy.ai/v3/config')
  assert.equal(catalogURL('https://private.example/api/v1'), 'https://private.example/api/v1/models')
})

test('catalog selects CLI chat models, maps capacity, and rejects refused or empty replies', () => {
  assert.deepEqual(parseCatalog({ code: 0, data: {
    agents: [{ name: 'cli', models: ['chat', 'image', 'disabled', 'no-tools'] }],
    models: [{ id: 'chat', name: 'Chat', maxAllowedSize: 100, maxOutputTokens: 200 },
      { id: 'not-cli' }, { id: 'image', tags: ['text-to-image'] },
      { id: 'disabled', disabled: true }, { id: 'no-tools', supportsToolCall: false }],
  } }), [{ id: 'chat', name: 'Chat', contextWindow: 100, maxTokens: 100 }])
  assert.deepEqual(parseCatalog({ data: [{ id: 'one' }, { id: 'one' }, { id: ' ' }] }), [{ id: 'one' }])
  for (const reply of [{ code: 123, data: { models: [{ id: 'wrong' }] } }, { data: [] }, {}, { data: { models: null } }]) {
    assert.throws(() => parseCatalog(reply))
  }
})

test('catalog parses thinking levels, defaults, and image capability', () => {
  const parsed = parseCatalog({ code: 0, data: { models: [
    { id: 'deepseek', name: 'DeepSeek', supportsReasoning: true, supportsImages: true,
      reasoning: { canDisableThinking: true, defaultEffort: 'high', supportedEfforts: ['low', 'high', 'max'] } },
    { id: 'legacy', supportsReasoning: true, reasoning: { effort: 'medium', summary: 'auto' } },
    { id: 'plain', supportsReasoning: false },
    { id: 'textonly', supportsImages: false },
  ] } })
  const byId = Object.fromEntries(parsed.map(model => [model.id, model]))
  // none (disable) first, then the catalog ladder; default is the advertised one.
  assert.deepEqual(byId.deepseek.reasoningEfforts, ['none', 'low', 'high', 'max'])
  assert.equal(byId.deepseek.defaultReasoningEffort, 'high')
  assert.equal(byId.deepseek.canDisableThinking, true)
  assert.equal(byId.deepseek.supportsImages, true)
  // A single legacy effort is a one-level ladder without a disable level.
  assert.deepEqual(byId.legacy.reasoningEfforts, ['medium'])
  assert.equal(byId.legacy.defaultReasoningEffort, 'medium')
  assert.equal(byId.legacy.canDisableThinking, undefined)
  // No reasoning declared → no thinking control.
  assert.equal(byId.plain.reasoningEfforts, undefined)
  assert.equal(byId.textonly.supportsImages, false)
})

test('adapter advertises parsed thinking levels and image modality per model', async t => {
  const connection = { baseURL: 'https://gateway.example/v2', resolveApiKey: async () => 'ck_fake',
    fetch: async () => Response.json({ data: [
      { id: 'reasoner', supportsImages: true, reasoning: { canDisableThinking: true, defaultEffort: 'high', supportedEfforts: ['low', 'high'] } },
      { id: 'textonly', supportsImages: false },
    ] }) }
  const catalog = new ModelCatalog([], connection)
  t.after(() => catalog.dispose())
  await catalog.refresh()
  const adapter = new CodeBuddyAdapter(Config({}), { ...connection, catalog })
  const models = Object.fromEntries((await adapter.listModels('workbuddy')).map(model => [model.id, model]))
  assert.deepEqual(models.reasoner.inputModalities, ['text', 'image'])
  assert.deepEqual(models.textonly.inputModalities, ['text'])
  const resolved = await adapter.resolveModel('workbuddy', 'reasoner')
  assert.deepEqual(resolved.reasoning.efforts.map(effort => effort.id), ['none', 'low', 'high'])
  assert.equal(resolved.reasoning.defaultEffort, 'high')
})

test('startup refresh deduplicates calls; elapsed time and selector reads never refresh; manual overrides win', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 })
  let calls = 0, changed = 0, refuse = false
  const connection = { baseURL: 'https://gateway.example/v2', resolveApiKey: async () => 'ck_fake', fetch: async (url, options) => {
    calls++
    assert.equal(url, 'https://gateway.example/v2/models')
    assert.equal(options.headers['X-API-Key'], 'ck_fake')
    assert.equal(options.redirect, 'error')
    return refuse ? new Response('unavailable', { status: 503 }) : Response.json({ data: [{ id: 'remote', name: 'Server', maxTokens: 25 }] })
  } }
  const catalog = new ModelCatalog([{ id: 'auto', name: 'Auto' }, { id: 'remote', name: 'Custom' }], connection, () => changed++)
  t.after(() => catalog.dispose())
  await Promise.all([catalog.refresh(), catalog.refresh(), catalog.refresh()])
  assert.equal(calls, 1)
  assert.equal(changed, 1)
  assert.deepEqual(catalog.models(), [
    { id: 'auto', name: 'Auto', contextWindow: 512000 },
    { id: 'remote', name: 'Custom', maxTokens: 25, contextWindow: 512000 },
  ])
  const adapter = new CodeBuddyAdapter(Config({}), { ...connection, catalog })
  t.mock.timers.tick(86400000)
  for (let index = 0; index < 3; index++) {
    assert.deepEqual((await adapter.listModels('workbuddy')).map(model => model.id), ['auto', 'remote'])
  }
  assert.equal(calls, 1)
  refuse = true
  await catalog.refresh()
  assert.equal(calls, 2)
  assert.equal(catalog.models()[1].name, 'Custom')
  assert.deepEqual((await adapter.listModels('workbuddy')).map(model => model.id), ['auto', 'remote'])
  assert.equal((await adapter.resolveModel('workbuddy', 'remote')).defaultMaxTokens, 25)
})

test('credential changes abort stale requests and cannot publish the previous account catalog', async t => {
  let release, oldSignal, calls = 0
  const catalog = new ModelCatalog([{ id: 'auto' }], {
    baseURL: 'https://gateway.example/v2', resolveApiKey: async () => 'ck_fake',
    fetch: async (_url, options) => {
      if (++calls === 1) { oldSignal = options.signal; return await new Promise(resolve => { release = resolve }) }
      return Response.json({ data: [{ id: 'new-account' }] })
    },
  })
  t.after(() => catalog.dispose())
  const stale = catalog.refresh()
  await new Promise(resolve => setImmediate(resolve))
  catalog.credentialsChanged()
  await catalog.refresh()
  assert.equal(oldSignal.aborted, true)
  release(Response.json({ data: [{ id: 'old-account' }] }))
  await stale
  assert.deepEqual(catalog.models().map(model => model.id), ['auto', 'new-account'])
  catalog.dispose()
  await catalog.refresh()
  assert.equal(calls, 2)
})

test('DSH startup, credential save, and disposal update the real model registry', async t => {
  let model = 'first', calls = 0
  const server = createServer((request, response) => {
    calls++
    assert.equal(request.url, '/v2/models')
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ data: [{ id: model }] }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const ctx = new Context()
  const runtime = ctx.plugin(LlmRuntime)
  await runtime.await()
  const interval = t.mock.method(globalThis, 'setInterval')
  const fiber = ctx.plugin(plugin, { workbuddy: { baseURL: `http://127.0.0.1:${server.address().port}/v2` } })
  await fiber.await()
  t.after(() => ctx.fiber.dispose())
  assert.deepEqual((await ctx.llm.listModels('workbuddy')).map(model => model.id), ['auto'])
  // DSH can mount its credential store after the route has already started.
  ctx.provide('credentials', { resolve: async () => ({ value: 'ck_fake', source: 'file' }) })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual((await ctx.llm.listModels('workbuddy')).map(model => model.id), ['auto', 'first'])
  model = 'second'
  ctx.emit('credentials/reference-updated', 'DSH_PROVIDER_WORKBUDDY_API_KEY')
  assert.deepEqual((await ctx.llm.listModels('workbuddy')).map(model => model.id), ['auto', 'second'])
  assert.equal(calls, 2)
  assert.equal(interval.mock.callCount(), 0)
  await fiber.dispose()
  assert.deepEqual(ctx.llm.listProviders(), [])
})

test('every model runs with a 500K window, capped by its own declared maximum', () => {
  const catalog = new ModelCatalog([
    { id: 'big', name: 'Big' },
    { id: 'small', name: 'Small', contextWindow: 192 * 1024 },
  ], { baseURL: 'https://gateway.example/v2' })
  const models = Object.fromEntries(catalog.models().map(model => [model.id, model]))
  assert.equal(models.big.contextWindow, 500 * 1024)
  assert.equal(models.small.contextWindow, 192 * 1024)
})
