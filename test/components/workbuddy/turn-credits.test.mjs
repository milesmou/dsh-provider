import '../../../harness-setup.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { SessionStore } from '@deepseek-ai/dsh-session'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CreditLedger } from '../../../lib/components/workbuddy/credits.js'
import { TurnCredits } from '../../../lib/components/workbuddy/turn-credits.js'
import { CodeBuddyAdapter } from '../../../lib/components/workbuddy/adapter.js'
import { Config } from '../../../lib/components/workbuddy/config.js'
import { REMOTE } from '../../../lib/components/workbuddy/remote.js'
import * as plugin from '../../../lib/index.js'

const start = turn => ({ type: 'turn/start', data: { turn } })
const end = turn => ({ type: 'turn/end', data: { turn, reason: { kind: 'stop' } } })
const options = { provider: 'workbuddy', model: 'auto', sessionId: 'one',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }
const completion = (credit, reason = 'stop') => new Response([
  { choices: [{ index: 0, delta: { content: 'hello' }, finish_reason: reason }] },
  { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, credit } },
].map(value => `data: ${JSON.stringify(value)}\n\n`).join('') + 'data: [DONE]\n\n',
{ headers: { 'Content-Type': 'text/event-stream' } })
const drain = async stream => { for await (const _ of stream) { /* consume */ } }

test('turn charges aggregate tool steps, keep zero, and distinguish absent or partial data', () => {
  const turns = new TurnCredits(new CreditLedger())
  turns.observe('one', start(1))
  turns.observe('two', start(1))
  const late = turns.begin('one')
  turns.begin('one')(0.01)
  turns.observe('one', { type: 'step/start', data: { turn: 1, step: 2 } })
  turns.begin('one')(0.02)
  turns.begin('two')(0)
  assert.deepEqual(turns.read('one', 1), { tracked: true, partial: false, used: 0.03 })
  assert.deepEqual(turns.read('two', 1), { tracked: true, partial: false, used: 0 })
  turns.observe('one', end(1))
  assert.equal(turns.begin('one'), undefined)
  turns.observe('one', start(2))
  turns.begin('one')()
  assert.deepEqual(turns.read('one', 2), { tracked: true, partial: true })
  for (const value of [NaN, Infinity, -1]) turns.begin('one')(value)
  turns.begin('one')(0.000001)
  assert.deepEqual(turns.read('one', 2), { tracked: true, partial: true, used: 0.000001 })
  late(0.04)
  late(99)
  assert.deepEqual(turns.read('one', 1), { tracked: true, partial: false, used: 0.07 })
  assert.deepEqual(turns.read('unknown', 1), { tracked: false })
  assert.equal(turns.begin(undefined), undefined)
  const pending = turns.begin('one')
  turns.forget('one')
  assert.equal(turns.begin('one'), undefined)
  turns.dispose()
  pending(99)
  assert.equal(turns.read('one', 2).used, 0.000001)
})

test('turn figures survive reload without persisting credentials or response content', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-turn-credits-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const filename = join(dir, 'turns.json')
  const ledger = new CreditLedger(filename)
  const turns = new TurnCredits(ledger)
  turns.observe('one', start(3))
  turns.begin('one')(0.03)
  turns.begin('one')()
  await ledger.persist()
  assert.deepEqual(new TurnCredits(new CreditLedger(filename)).read('one', 3), { tracked: true, partial: true, used: 0.03 })
})

for (const [name, credit, reason, workbuddy] of [['exact', 0.03, 'stop'], ['WorkBuddy login', 0.03, 'stop', true], ['free', 0, 'stop'], ['missing', undefined, 'stop'],
  ['invalid', -1, 'stop'], ['filtered', 0.02, 'content_filter'], ['incomplete', 0.04, null]]) {
  test(`stream settlement records ${name} charges once, including failed completions`, async () => {
    const turns = new TurnCredits(new CreditLedger())
    turns.observe('one', start(1))
    const accountCharges = []
    const adapter = new CodeBuddyAdapter(Config({}), { baseURL: 'https://copilot.tencent.com/v2',
      workbuddy, ...(workbuddy ? { authenticate: async () => ({ apiKey: 'test-secret', headers: {} }) } : {}),
      resolveApiKey: async () => 'test-secret', fetch: async () => completion(credit, reason),
      beginTurnCredit: id => turns.begin(id), recordCredit: (_id, value) => accountCharges.push(value) })
    const result = drain(adapter.stream(options))
    if (reason !== 'stop') await assert.rejects(result)
    else await result
    const valid = credit !== undefined && credit >= 0
    assert.deepEqual(turns.read('one', 1), { tracked: true, partial: !valid, ...(valid ? { used: credit } : {}) })
    assert.deepEqual(accountCharges, valid ? [credit] : [])
  })
}

test('aborted streams retain unknown charges and background purposes do not join the user turn', async () => {
  const turns = new TurnCredits(new CreditLedger())
  turns.observe('one', start(1))
  const controller = new AbortController()
  const adapter = new CodeBuddyAdapter(Config({}), { baseURL: 'https://copilot.tencent.com/v2',
    resolveApiKey: async () => 'test-secret', beginTurnCredit: id => turns.begin(id),
    fetch: async (_url, init) => new Promise((_resolve, reject) => {
      controller.abort()
      reject(init.signal.reason)
    }) })
  await assert.rejects(drain(adapter.stream({ ...options, signal: controller.signal })))
  assert.deepEqual(turns.read('one', 1), { tracked: true, partial: true })
  const background = new CodeBuddyAdapter(Config({}), { baseURL: 'https://copilot.tencent.com/v2',
    resolveApiKey: async () => 'test-secret', fetch: async () => completion(1), beginTurnCredit: id => turns.begin(id) })
  await drain(background.stream({ ...options, purpose: 'session-title' }))
  await drain(background.stream({ ...options, purpose: 'compaction' }))
  assert.deepEqual(turns.read('one', 1), { tracked: true, partial: true })
})

test('real session events and provider lifecycle bind requests to turns and publish only credit figures', async t => {
  const ctx = new Context()
  let key = 'old-test-key'
  const charges = [0.01, 0.5, 0.02]
  t.mock.method(globalThis, 'fetch', async input => new URL(input.url ?? input).pathname.endsWith('/chat/completions')
    ? completion(charges.shift()) : Response.json({ data: [{ id: 'auto' }] }))
  ctx.provide('credentials', { resolve: async () => ({ value: key, source: 'file' }) })
  try {
    await ctx.plugin(LlmRuntime).await()
    await ctx.plugin(SessionStore).await()
    const fiber = ctx.plugin(plugin, { workbuddy: {} })
    await fiber.await()
    const session = ctx.sessions.create('one')
    const other = ctx.sessions.create('two')
    const turns = ctx.workbuddyProvider.options.turnCredits
    session.append('turn/start', { turn: 1 })
    other.append('turn/start', { turn: 1 })
    const pendingOldAccount = turns.begin('one')
    await drain(ctx.llm.stream(options))
    await drain(ctx.llm.stream({ ...options, sessionId: 'two' }))
    // A credential change does not reassign an existing turn's exact charges.
    key = 'new-test-key'
    ctx.emit('credentials/reference-updated', 'DSH_PROVIDER_WORKBUDDY_API_KEY')
    await drain(ctx.llm.stream(options))
    pendingOldAccount(0.03)
    session.append('turn/end', { turn: 1, reason: { kind: 'stop' } })
    const view = await ctx.workbuddyProvider.turnCredits('one', 1)
    assert.deepEqual(view, { tracked: true, partial: false, used: 0.06 })
    const method = REMOTE.methods['workbuddyProvider/turnCredits']
    assert.deepEqual(method.result.create().parse(view), view)
    assert.throws(() => method.parameters[1].codec.create().parse(-1))
    assert.throws(() => method.parameters[1].codec.create().parse(1.5))
    assert.deepEqual(await ctx.workbuddyProvider.turnCredits('two', 1), { tracked: true, partial: false, used: 0.5 })
    await fiber.dispose()
    assert.equal(ctx.get('workbuddyProvider'), undefined)
    other.append('turn/end', { turn: 1, reason: { kind: 'stop' } })
    assert.equal(turns.begin('two'), undefined)
    await ctx.plugin(plugin, { workbuddy: {} }).await()
    assert.deepEqual(await ctx.workbuddyProvider.turnCredits('one', 1), view)
  } finally { await ctx.fiber.dispose() }
})
