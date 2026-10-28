import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { parseBillingSummary, CreditLedger } from '../../../lib/components/workbuddy/credits.js'
import { CodeBuddyAdapter } from '../../../lib/components/workbuddy/adapter.js'
import { Config } from '../../../lib/components/workbuddy/config.js'
import { REMOTE } from '../../../lib/components/workbuddy/remote.js'

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
  for await (const _ of adapter.stream(options)) { /* drain */ }
  assert.deepEqual(charges, [{ sessionId: 'sess-1', credit: 0.03 }])
})

test('the credits Remote is declared with a session id parameter', () => {
  const method = REMOTE.methods['workbuddyProvider/credits']
  assert.ok(method, 'credits method declared')
  assert.equal(method.parameters[0].name, 'sessionId')
})
