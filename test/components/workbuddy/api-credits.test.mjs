import '../../../harness-setup.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { ApiCredits, parseApiCredits, API_BILLING_PATH } from '../../../lib/components/workbuddy/api-credits.js'
import { CreditLedger } from '../../../lib/components/workbuddy/credits.js'
import { WorkBuddyController } from '../../../lib/components/workbuddy/controller.js'
import { REMOTE } from '../../../lib/components/workbuddy/remote.js'
import { mockCodeBuddyGateway } from '../../../harness-setup.mjs'
import { createServer } from 'node:http'
import { once } from 'node:events'
import * as plugin from '../../../lib/index.js'

const resource = (extra = {}) => ({ ProductCode: 'p_tcaca', CapacityUnit: 'credits', Status: 0,
  CycleCapacityRemain: 80, CycleCapacitySize: 100, CycleCapacityUsed: 20,
  AccountId: 'private-account', Uin: 'private-user', ...extra })
const payload = (accounts = [resource()]) => ({ code: 0, data: { Response: { Data: { TotalCount: accounts.length, Accounts: accounts } } } })
const response = (remain = 80) => Response.json(payload([resource({ CycleCapacityRemain: remain })]))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const baseURL = 'https://copilot.tencent.com/v2'
const setup = (connection = {}) => {
  const ledger = new CreditLedger()
  const credits = new ApiCredits(ledger, { baseURL, resolveApiKey: async () => 'test-secret', ...connection })
  return { ledger, credits }
}

test('API billing aggregates complete current credit resources without exposing account metadata', () => {
  const now = Date.parse('2026-10-29T00:00:00Z')
  const result = parseApiCredits(payload([
    resource({ DeductionStartTime: 0 }), resource({ CycleCapacityRemainPrecise: '0.123456', CycleCapacitySizePrecise: '1', CycleCapacityUsedPrecise: '0.876544' }),
    resource({ ExpiredTime: '2026-10-29 07:59:59' }),
    resource({ DeductionStartTime: '2026-10-30T00:00:00+08:00' }),
    resource({ DeductionStartTime: Date.parse('2026-10-30T00:00:00+08:00') / 1000 }),
    resource({ ProductCode: 'other-product' }), resource({ Status: 2 }), resource({ CapacityUnit: 'tokens' }),
  ]), now)
  assert.deepEqual(result, { remain: 80.123456, total: 101, used: 20.876544, unit: 'credits' })
  assert.doesNotMatch(JSON.stringify(result), /private|AccountId|Uin/)
  assert.equal(parseApiCredits(payload([resource({ CycleCapacityRemain: 0 })])).remain, 0)
  assert.deepEqual(parseApiCredits(payload([])), { remain: 0, total: 0, used: 0, unit: 'credits' })
  for (const invalid of [{}, { code: 401 }, { code: 0, data: {} },
    { ...payload(), data: { Response: { Data: { TotalCount: 2, Accounts: [resource()] } } } },
    payload([resource({ CycleCapacityRemain: null })]), payload([resource({ CycleCapacitySize: undefined })]),
    payload([resource({ CycleCapacityUsed: undefined })]), payload([resource({ ProductCode: undefined })]),
    payload([resource({ ExpiredTime: 'unreadable' })]),
  ]) assert.throws(() => parseApiCredits(invalid))
})

test('API balances share a 60-second cache across sessions and project only exact recorded charges', async t => {
  let now = 1000, calls = 0
  const { credits } = setup({ now: () => now, fetch: async (url, init) => {
    calls++
    assert.equal(url, 'https://copilot.tencent.com' + API_BILLING_PATH)
    assert.equal(init.redirect, 'error')
    assert.equal(init.headers.Authorization, 'Bearer test-secret')
    assert.equal(init.headers['X-API-Key'], 'test-secret')
    assert.equal(init.headers['X-IDE-Name'], 'CodeBuddy')
    assert.deepEqual(JSON.parse(init.body), { ProductCode: 'p_tcaca', Status: [0, 3] })
    return response()
  } })
  t.after(() => credits.dispose())
  const [one, two] = await Promise.all([credits.read('one'), credits.read('two')])
  assert.equal(calls, 1)
  assert.equal(one.accountRemain, 80)
  assert.equal(two.accountRemain, 80)
  credits.record('one', 0.03, 'test-secret')
  credits.record('two', 0.02, 'test-secret')
  assert.equal((await credits.read('one')).sessionUsed, 0.03)
  assert.equal((await credits.read('two')).sessionUsed, 0.02)
  assert.equal((await credits.read('one')).accountRemain, 79.95)
  assert.equal(calls, 1)
  now += 60000
  assert.equal((await credits.read('one')).accountRemain, 80)
  assert.equal(calls, 2)
  await credits.read('one', true)
  assert.equal(calls, 3)
})

for (const oldStatus of [200, 401]) test(`API key changes isolate charges and discard late replies (${oldStatus})`, async t => {
  let key = 'test-secret'
  const old = deferred(), started = deferred()
  const { credits } = setup({ resolveApiKey: async () => key, fetch: async (_url, init) => {
    if (init.headers['X-API-Key'] === 'test-secret') { started.resolve(); return old.promise }
    return response(22)
  } })
  t.after(() => credits.dispose())
  const first = credits.read('one')
  await started.promise
  key = 'second-secret'
  credits.record('one', 2, 'test-secret')
  credits.record('one', 0.1, 'second-secret')
  const current = await credits.read('one')
  assert.equal(current.accountRemain, 22)
  assert.equal(current.sessionUsed, 0.1)
  old.resolve(oldStatus === 200 ? response(99) : new Response('private-secret', { status: oldStatus }))
  assert.equal((await first).accountRemain, undefined)
  assert.equal((await credits.read('one')).accountRemain, 22)
})

test('API failures label retained caches, remove rejected balances and redact all diagnostics', async t => {
  let state = 'ok', key = 'test-secret'
  const { credits } = setup({ resolveApiKey: async () => { if (!key) throw new Error('private-secret'); return key },
    fetch: async () => {
      if (state === 'offline') throw new Error('private-account test-secret')
      if (state === 'denied') return new Response('private-server-body', { status: 401 })
      return response()
    } })
  t.after(() => credits.dispose())
  await credits.read('one')
  state = 'offline'
  const stale = await credits.read('one', true)
  assert.equal(stale.accountRemain, 80)
  assert.equal(stale.stale, true)
  assert.match(stale.issue, /缓存/)
  assert.doesNotMatch(JSON.stringify(stale), /private|test-secret/)
  state = 'denied'
  const denied = await credits.read('one', true)
  assert.equal(denied.accountRemain, undefined)
  assert.doesNotMatch(JSON.stringify(denied), /private|test-secret/)
  key = ''
  const missing = await credits.read('one')
  assert.equal(missing.accountRemain, undefined)
  assert.equal(missing.sessionUsed, undefined)
})

test('invalidating and returning to the same API key cannot revive an old balance reply', async t => {
  const old = deferred(), started = deferred()
  let calls = 0
  const { credits } = setup({ fetch: async () => { if (++calls === 1) { started.resolve(); return old.promise }; return response(22) } })
  t.after(() => credits.dispose())
  const first = credits.read('one')
  await started.promise
  credits.invalidate()
  assert.equal((await credits.read('one')).accountRemain, 22)
  old.resolve(response(99))
  assert.equal((await first).accountRemain, undefined)
  assert.equal((await credits.read('one')).accountRemain, 22)
})

test('a missing key during an in-flight read invalidates API balances', async t => {
  let key = 'test-secret'
  const { credits } = setup({ resolveApiKey: async () => { if (!key) throw new Error(); return key },
    fetch: async () => { key = ''; return response() } })
  t.after(() => credits.dispose())
  assert.equal((await credits.read('one')).accountRemain, undefined)
})

test('API timeouts, invalidation and disposal abort requests and prevent cached replies', async () => {
  const idle = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
  const keepAlive = setTimeout(() => {}, 1000)
  const { credits } = setup({ fetch: idle, timeoutMs: 15 })
  try {
    assert.equal((await credits.read('one')).accountRemain, undefined)
    const pending = credits.read('one', true)
    await new Promise(setImmediate)
    credits.invalidate()
    assert.equal((await pending).accountRemain, undefined)
    const disposing = credits.read('one', true)
    await new Promise(setImmediate)
    credits.dispose()
    assert.equal((await disposing).accountRemain, undefined)
    assert.deepEqual(await credits.read('one'), { enabled: false })
  } finally { clearTimeout(keepAlive); credits.dispose() }
})

test('the credits controller uses the API reader without accessing WorkBuddy login credentials', async () => {
  let read
  const fake = { options: { enabled: () => false, apiCredits: () => ({ read: async (...args) => {
    read = args; return { enabled: true, mode: 'api', sessionUsed: 1, accountRemain: 2 }
  } }), session: () => { throw new Error('must not read WorkBuddy login') } } }
  assert.equal((await WorkBuddyController.prototype.credits.call(fake, 'one', true)).accountRemain, 2)
  assert.deepEqual(read, ['one', true])
  const codec = REMOTE.methods['workbuddyProvider/credits'].result.create()
  const safe = codec.parse({ enabled: true, mode: 'api', updatedAt: 123, stale: true, issue: 'cached', access_token: 'private', account_id: 'private' })
  assert.doesNotMatch(JSON.stringify(safe), /private|access_token|account_id/)
})

test('the real Cordis API-key provider records usage and disposes its balance reader', async t => {
  let billingCalls = 0
  const server = createServer(async (req, res) => {
    for await (const _ of req) { /* drain */ }
    if (req.url === API_BILLING_PATH) { billingCalls++; res.end(JSON.stringify(payload())); return }
    if (req.url === '/v3/config') { res.end(JSON.stringify({ data: [{ id: 'auto' }] })); return }
    res.setHeader('content-type', 'text/event-stream')
    res.end('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: 'OK' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, credit: 0.03 } }) + '\n\ndata: [DONE]\n\n')
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  mockCodeBuddyGateway(t, `http://127.0.0.1:${server.address().port}`)
  const ctx = new Context()
  ctx.provide('credentials', { resolve: async () => ({ value: 'test-secret', source: 'file' }) })
  await ctx.plugin(LlmRuntime).await()
  await ctx.plugin(plugin, { workbuddy: {} }).await()
  try {
    const controller = ctx.get('workbuddyProvider')
    assert.equal((await controller.credits('one', false)).accountRemain, 80)
    for await (const _ of ctx.llm.stream({ provider: 'workbuddy', model: 'auto', sessionId: 'one',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'OK' }] }] })) { /* drain */ }
    const view = await controller.credits('one', false)
    assert.equal(view.sessionUsed, 0.03)
    assert.equal(view.accountRemain, 79.97)
    assert.equal(billingCalls, 1)
  } finally { await ctx.fiber.dispose() }
})
