import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseBillingSummary, CreditLedger, projectRemain, turnCreditIndex, turnCreditOf } from '../../../lib/components/workbuddy/credits.js'
import { CodeBuddyAdapter } from '../../../lib/components/workbuddy/adapter.js'
import { Config } from '../../../lib/components/workbuddy/config.js'
import { REMOTE } from '../../../lib/components/workbuddy/remote.js'
import { WorkBuddyController } from '../../../lib/components/workbuddy/controller.js'

test('billing summary aggregates package capacities and names the plan', () => {
  const summary = parseBillingSummary({
    TotalCredits: '4940.52', SubscriptionPackageName: '体验版',
    Packages: [
      { CycleTotalCapacity: '4500', CycleRemainCapacity: '4500', CycleUsedCapacity: '0', CapacityUnit: 'credits' },
      { CycleTotalCapacity: '500', CycleRemainCapacity: '440.52', CycleUsedCapacity: '59.48', CapacityUnit: 'credits' },
    ],
  })
  assert.deepEqual(summary, { remain: 4940.52, total: 5000, used: 59.48, unit: 'credits', plan: '体验版' })
  // No package list: TotalCredits is the remaining balance.
  assert.deepEqual(parseBillingSummary({ TotalCredits: '12.5' }), { remain: 12.5, total: 12.5, used: 0, unit: 'credits' })
  // Unrecognisable payload yields no balance instead of throwing.
  assert.equal(parseBillingSummary({}), undefined)
  assert.equal(parseBillingSummary(null), undefined)
})

test('the credit ledger accumulates per session and guards invalid charges', () => {
  const ledger = new CreditLedger()
  ledger.add('s1', 0.01)
  ledger.add('s1', 0.02)
  ledger.add('s2', 0.5)
  ledger.add(undefined, 1)
  ledger.add('s1', Number.NaN)
  ledger.add('s1', -3)
  assert.equal(ledger.of('s1'), 0.03)
  assert.equal(ledger.of('s2'), 0.5)
  assert.equal(ledger.of('missing'), 0)
  assert.equal(ledger.of(undefined), 0)
})

test('the credit ledger rounds accumulated float charges', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-credit-ledger-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'credits.json')
  const ledger = new CreditLedger(file)
  ledger.add('s1', 0.1)
  ledger.add('s1', 0.2)
  assert.equal(ledger.of('s1'), 0.3)
  await ledger.persist()
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { s1: 0.3 })
  // A legacy file carrying float artifacts is normalized when read back.
  await writeFile(file, JSON.stringify({ s1: 0.30000000000000004 }), 'utf8')
  const legacy = new CreditLedger(file)
  assert.equal(legacy.of('s1'), 0.3)
})

test('the turn-credit index resolves every message of a session in one pass', () => {
  const events = [
    { type: 'assistant/message', data: { turn: 1, message: { id: 'a1', source: { provider: 'workbuddy' } }, usage: { credit: 0.01 } } },
    { type: 'assistant/message', data: { turn: 1, message: { id: 'a2', source: { provider: 'workbuddy' } }, usage: { credit: 0.02 } } },
    { type: 'assistant/message', data: { turn: 2, message: { id: 'b1', source: { provider: 'workbuddy' } }, usage: { credit: 0.5 } } },
    { type: 'assistant/message', data: { turn: 2, message: { id: 'b2', source: { provider: 'workbuddy' } }, usage: {} } },
    { type: 'assistant/message', data: { turn: 3, message: { id: 'x', source: { provider: 'deepseek' } }, usage: { credit: 0.9 } } },
  ]
  const index = turnCreditIndex(events)
  assert.equal(index.get('a1'), 0.03)
  assert.equal(index.get('a2'), 0.03)
  assert.equal(index.get('b1'), 0.5)
  assert.equal(index.get('b2'), 0.5)
  assert.equal(index.has('x'), false)
  assert.equal(index.has('missing'), false)
})

test('the ledger persists session totals across plugin reloads', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-credit-ledger-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'nested', 'credits.json')
  const ledger = new CreditLedger(file)
  ledger.add('s1', 0.03)
  ledger.add('s2', 0.5)
  ledger.add('s2', 0.25)
  await ledger.persist()
  const reloaded = new CreditLedger(file)
  assert.equal(reloaded.of('s1'), 0.03)
  assert.equal(reloaded.of('s2'), 0.75)
  assert.equal(reloaded.of('new-session'), 0)
})

test('a corrupt ledger file starts empty instead of throwing', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-credit-ledger-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'credits.json')
  await writeFile(file, '{ not json', 'utf8')
  const ledger = new CreditLedger(file)
  assert.equal(ledger.of('s1'), 0)
})

const chunk = (delta, finish_reason = null) => ({ id: 'chat-1', object: 'chat.completion.chunk', created: 1,
  model: 'auto', choices: [{ index: 0, delta, finish_reason }] })
const sse = (...chunks) => chunks.map(value => `data: ${JSON.stringify(value)}\n\n`).join('') + 'data: [DONE]\n\n'

test('the adapter reports each call\'s usage credit to the session ledger', async t => {
  const server = createServer(async (req, res) => {
    for await (const _ of req) { /* drain */ }
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end(sse(
      chunk({ content: 'hi' }, 'stop'),
      { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, credit: 0.03 } },
    ))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const charges = []
  const adapter = new CodeBuddyAdapter(Config({}), {
    baseURL: `http://127.0.0.1:${server.address().port}/v2`,
    resolveApiKey: async () => 'ck_fake',
    recordCredit: (sessionId, credit) => charges.push({ sessionId, credit }),
  })
  const options = { provider: 'workbuddy', model: 'auto', sessionId: 'sess-1',
    messages: [{ role: 'user', content: [{ type: 'text', text: '你好' }] }] }
  let reported
  for await (const part of adapter.stream(options)) if (part.type === 'usage') reported = part.usage
  assert.deepEqual(charges, [{ sessionId: 'sess-1', credit: 0.03 }])
  // The same charge rides on the usage sample the session records, which is
  // what lets a completed Turn's spend be read back later.
  assert.equal(reported.credit, 0.03)
})

test('a Turn\'s credit sums every assistant step of the Turn owning a message', () => {
  const events = [
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'assistant/message', data: { turn: 1, message: { id: 'a1', source: { provider: 'workbuddy' } }, usage: { credit: 0.01 } } },
    { type: 'assistant/message', data: { turn: 1, message: { id: 'a2', source: { provider: 'workbuddy' } }, usage: { credit: 0.02 } } },
    { type: 'assistant/message', data: { turn: 2, message: { id: 'b1', source: { provider: 'workbuddy' } }, usage: { credit: 0.5 } } },
    { type: 'assistant/message', data: { turn: 2, message: { id: 'b2', source: { provider: 'workbuddy' } }, usage: {} } },
  ]
  assert.equal(turnCreditOf(events, 'a2'), 0.03)
  assert.equal(turnCreditOf(events, 'b1'), 0.5)
  // A zero charge is still a disclosed charge and renders as 0.
  assert.equal(turnCreditOf([{ type: 'assistant/message', data: { turn: 7, message: { id: 'free', source: { provider: 'workbuddy' } }, usage: { credit: 0 } } }], 'free'), 0)
  assert.equal(turnCreditOf(events, 'missing'), undefined)
  // Another provider's usage is never reported as a WorkBuddy credit.
  const foreign = [{ type: 'assistant/message', data: { turn: 3, message: { id: 'x', source: { provider: 'deepseek' } }, usage: { credit: 0.9 } } }]
  assert.equal(turnCreditOf(foreign, 'x'), undefined)
})

test('the turnCredit Remote is declared with session and message ids', () => {
  const method = REMOTE.methods['workbuddyProvider/turnCredit']
  assert.ok(method, 'turnCredit method declared')
  assert.equal(method.parameters[0].name, 'sessionId')
  assert.equal(method.parameters[1].name, 'messageId')
  assert.equal(REMOTE.methods['workbuddyProvider/probe'], undefined, 'diagnostic probe is not shipped')
})

test('the controller reads a Turn credit from the session log on demand', async () => {
  const events = [
    { type: 'assistant/message', data: { turn: 1, message: { id: 'a1', source: { provider: 'workbuddy' } }, usage: { credit: 0.01 } } },
    { type: 'assistant/message', data: { turn: 1, message: { id: 'a2', source: { provider: 'workbuddy' } }, usage: { credit: 0.02 } } },
  ]
  const session = { snapshotEvents: () => events }
  const fake = {
    host: { get: (name) => name === 'sessions' ? { get: id => id === 's1' ? session : undefined } : undefined },
    creditIndexes: new WeakMap(),
  }
  const proto = WorkBuddyController.prototype
  assert.deepEqual(await proto.turnCredit.call(fake, 's1', 'a2'), { credits: 0.03 })
  assert.deepEqual(await proto.turnCredit.call(fake, 's1', 'unknown'), {})
  assert.deepEqual(await proto.turnCredit.call(fake, 'missing', 'a2'), {})
  assert.deepEqual(await proto.turnCredit.call({ host: { get: () => undefined } }, 's1', 'a2'), {})
})

test('the credits Remote is declared with a session id parameter', () => {
  const method = REMOTE.methods['workbuddyProvider/credits']
  assert.ok(method, 'credits method declared')
  assert.equal(method.parameters[0].name, 'sessionId')
  assert.equal(method.parameters[1].name, 'refresh')
  assert.equal(method.parameters[1].codec.create().parse(true), true)
})

test('the remaining balance is projected by subtracting post-fetch session spend', () => {
  const balance = { remain: 100, total: 200, unit: 'credits', usedAtFetch: 5 }
  assert.equal(projectRemain(balance, 5), 100)   // no spend yet
  assert.equal(projectRemain(balance, 7.5), 97.5) // 2.5 spent since the fetch
  assert.equal(projectRemain(balance, 4), 100)   // never add back
  assert.equal(projectRemain(balance, 500), 0)   // clamped at zero
})

test('the controller fetches the balance once per session and only re-fetches on demand', async () => {
  const proto = WorkBuddyController.prototype
  const ledger = new CreditLedger()
  const calls = []
  let next = { remain: 1000, total: 2000, unit: 'credits', plan: 'pro' }
  const options = {
    enabled: () => true,
    ledger,
    session: () => ({ accountCredits: async () => { calls.push(next); return next } }),
  }
  const fake = { options, balances: new Map() }
  const read = refresh => proto.credits.call(fake, 's1', refresh)

  const first = await read(false)
  assert.deepEqual(first, { enabled: true, sessionUsed: 0, accountRemain: 1000, accountTotal: 2000, unit: 'credits', plan: 'pro' })
  assert.equal(calls.length, 1)

  ledger.add('s1', 12.5)
  const second = await read(false)
  assert.equal(calls.length, 1, 'no new billing request after the first snapshot')
  assert.equal(second.sessionUsed, 12.5)
  assert.equal(second.accountRemain, 987.5)

  // A manual refresh re-fetches and rebases on the current spend.
  next = { remain: 900, total: 2000, unit: 'credits', plan: 'pro' }
  const refreshed = await read(true)
  assert.equal(calls.length, 2)
  assert.equal(refreshed.accountRemain, 900)
  ledger.add('s1', 1)
  assert.equal((await read(false)).accountRemain, 899)

  // A failed forced refresh keeps the previous snapshot rather than dropping it.
  options.session = () => ({ accountCredits: async () => { throw new Error('offline') } })
  const kept = await read(true)
  assert.equal(kept.accountRemain, 899)
})

test('the controller reports disabled in API-key mode', async () => {
  const proto = WorkBuddyController.prototype
  const fake = { options: { enabled: () => false, ledger: new CreditLedger(),
    session: () => ({ accountCredits: async () => { throw new Error('must not be called') } }) }, balances: new Map() }
  assert.deepEqual(await proto.credits.call(fake, 's1', false), { enabled: false })
})
