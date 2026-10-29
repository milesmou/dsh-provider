import test from 'node:test'
import assert from 'node:assert/strict'
import { CodexQuota, parseQuota, QUOTA_URL } from '../../../lib/components/codex/quota.js'
import { QuotaReply, REMOTE } from '../../../lib/components/codex/remote.js'

const auth = { apiKey: 'test-secret', headers: { 'ChatGPT-Account-Id': 'test-account' } }
const payload = (used = 26) => ({ email: 'private-email', access_token: 'private-token', plan_type: 'plus', rate_limit: {
  primary_window: { used_percent: used, limit_window_seconds: 18000, reset_at: 2000000000 },
  secondary_window: { used_percent: 8, limit_window_seconds: 604800, reset_at: 2000500000 },
} })
const response = (used = 26) => new Response(JSON.stringify(payload(used)))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const session = { authenticate: async () => auth }

test('quota projects only confirmed windows, preserving zero usage and omitting missing values', () => {
  const view = parseQuota(payload(), 1000)
  assert.deepEqual(view, { available: true, updatedAt: 1000, plan: 'plus', windows: [
    { kind: 'primary', usedPercent: 26, windowDurationMins: 300, resetsAt: 2000000000 },
    { kind: 'secondary', usedPercent: 8, windowDurationMins: 10080, resetsAt: 2000500000 },
  ] })
  assert.doesNotMatch(JSON.stringify(view), /private|email|token|account/)
  assert.equal(parseQuota(payload(0)).windows[0].usedPercent, 0)
  assert.equal(parseQuota(payload(120)).windows[0].usedPercent, 100)
  assert.equal(parseQuota(payload(-2)).windows[0].usedPercent, 0)
  assert.throws(() => parseQuota({ rate_limit: { primary_window: { used_percent: null } } }))
  const partial = parseQuota({ rate_limit: { secondary_window: { used_percent: 100, reset_after_seconds: 30 } } }, 100000)
  assert.deepEqual(partial.windows, [{ kind: 'secondary', usedPercent: 100, resetsAt: 130 }])
})

test('quota authenticates cached reads, coalesces concurrent calls, and respects refresh and expiry', async t => {
  let calls = 0, now = 1000, authReads = 0
  const quota = new CodexQuota({ authenticate: async () => { authReads++; return auth } }, {
    now: () => now, fetch: async (url, init) => {
      calls++
      assert.equal(url, QUOTA_URL)
      assert.equal(init.redirect, 'error')
      assert.equal(init.headers.Authorization, 'Bearer test-secret')
      assert.equal(init.headers['ChatGPT-Account-Id'], 'test-account')
      return response()
    },
  })
  t.after(() => quota.dispose())
  const [first, second] = await Promise.all([quota.read(), quota.read()])
  assert.equal(calls, 1)
  assert.deepEqual(first, second)
  await quota.read()
  assert.equal(calls, 1)
  assert.ok(authReads >= 4)
  await quota.read(true)
  assert.equal(calls, 2)
  now += 60000
  await quota.read()
  assert.equal(calls, 3)
})

for (const oldStatus of [200, 401]) test(`late account responses (${oldStatus}) cannot overwrite a new login`, async t => {
  let current = auth
  const old = deferred(), started = deferred()
  const quota = new CodexQuota({ authenticate: async () => current }, { fetch: async (_url, init) => {
    if (init.headers.Authorization === 'Bearer test-secret') { started.resolve(); return old.promise }
    return response(77)
  } })
  t.after(() => quota.dispose())
  const first = quota.read()
  await started.promise
  current = { apiKey: 'new-secret', headers: { 'ChatGPT-Account-Id': 'new-account' } }
  assert.equal((await quota.read()).windows[0].usedPercent, 77)
  old.resolve(oldStatus === 200 ? response(10) : new Response('private-server-body', { status: oldStatus }))
  assert.equal((await first).available, false)
  assert.equal((await quota.read()).windows[0].usedPercent, 77)
})

test('a changed or removed login during a request discards the previous account result', async t => {
  let loggedIn = true
  const quota = new CodexQuota({ authenticate: async () => {
    if (!loggedIn) throw new Error('test-secret')
    return auth
  } }, { fetch: async () => { loggedIn = false; return response() } })
  t.after(() => quota.dispose())
  assert.equal((await quota.read()).available, false)
  assert.equal((await quota.read()).available, false)
})

test('failed updates retain a labeled same-account snapshot and never leak credentials', async t => {
  let failure = false, current = auth
  const quota = new CodexQuota({ authenticate: async () => current }, { fetch: async () => {
    if (failure) throw new Error('private-email test-secret private-token')
    return response()
  } })
  t.after(() => quota.dispose())
  await quota.read()
  failure = true
  const stale = await quota.read(true)
  assert.equal(stale.available, true)
  assert.equal(stale.stale, true)
  assert.equal(stale.windows[0].usedPercent, 26)
  assert.doesNotMatch(JSON.stringify(stale), /private|test-secret/)
  current = { apiKey: 'new-secret', headers: { 'ChatGPT-Account-Id': 'new-account' } }
  const next = await quota.read()
  assert.equal(next.available, false)
  assert.deepEqual(next.windows, [])
})

test('authorization failures remove previously cached quota without reflecting the server body', async t => {
  let denied = false
  const quota = new CodexQuota(session, { fetch: async () => denied ? new Response('test-secret', { status: 401 }) : response() })
  t.after(() => quota.dispose())
  await quota.read()
  denied = true
  const view = await quota.read(true)
  assert.equal(view.available, false)
  assert.deepEqual(view.windows, [])
  assert.doesNotMatch(JSON.stringify(view), /test-secret/)
})

test('timeout and disposal abort idle quota requests and prevent subsequent requests', async () => {
  const idle = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
  const quota = new CodexQuota(session, { fetch: idle, timeoutMs: 15 })
  // AbortSignal.timeout is unref'ed; keep the event loop alive for this bounded test.
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    assert.equal((await quota.read()).available, false)
    const pending = quota.read(true)
    await new Promise(setImmediate)
    quota.dispose()
    assert.equal((await pending).available, false)
    assert.equal((await quota.read()).available, false)
  } finally { clearTimeout(keepAlive); quota.dispose() }
})

test('the quota Remote validates refresh and strips private fields from its reply', () => {
  const method = REMOTE.methods['codexProvider/quota']
  assert.throws(() => method.input().create().parse({ refresh: 'read-secrets' }))
  const value = QuotaReply.parse({ ...parseQuota(payload()), account_id: 'private-account', access_token: 'test-secret' })
  assert.doesNotMatch(JSON.stringify(value), /private|test-secret|account_id|access_token/)
})
