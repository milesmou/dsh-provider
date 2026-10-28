import test from 'node:test'
import assert from 'node:assert/strict'
import { WorkBuddySession, parseDesktop, desktopAuthPath } from '../lib/workbuddy.js'
import { CodeBuddyAdapter } from '../lib/adapter.js'
import { workbuddyRequest } from '../lib/workbuddy-request.js'
import { Config } from '../lib/config.js'
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import { REMOTE } from '../lib/remote.js'

const desktop = (accessToken = 'desktop-secret') => ({ account: { uid: 'user', enterpriseId: 'team' },
  auth: { accessToken, refreshToken: 'desktop-refresh-never-used', expiresAt: Date.now() + 3600000, domain: 'tenant' } })
function store() {
  const records = new Map()
  let lock = Promise.resolve()
  return { records, readRecord: async key => records.get(key), deleteRecord: async key => { records.delete(key) },
    modifyRecord: (key, mutate) => {
      const task = lock.then(async () => {
        const next = await mutate(records.get(key))
        if (next !== undefined) records.set(key, next)
        return records.get(key)
      })
      lock = task.catch(() => {})
      return task
    },
  }
}
const envelope = data => Response.json({ code: 0, data })

test('desktop auth paths support Windows, macOS, and Linux; encrypted and expired sign-ins explain recovery', () => {
  assert.match(desktopAuthPath('cn', '/home/me', 'win32').replaceAll('\\', '/'), /AppData\/Local\/CodeBuddyExtension\/Data\/Public\/auth\/workbuddy-desktop.info$/)
  assert.match(desktopAuthPath('intl', '/home/me', 'darwin').replaceAll('\\', '/'), /Application Support\/CodeBuddyExtension\/Data\/Public\/auth\/workbuddy-desktop-ai.info$/)
  assert.match(desktopAuthPath('cn', '/home/me', 'linux').replaceAll('\\', '/'), /\.local\/share\/CodeBuddyExtension/)
  assert.equal(parseDesktop(desktop()).source, 'desktop')
  assert.equal(parseDesktop(desktop()).refresh, undefined)
  const encrypted = desktop({ $wbEncrypted: 1, envelope: 'never-log-this' })
  assert.throws(() => parseDesktop(encrypted), error => error.code === 'ENCRYPTED_CREDENTIAL' && !error.message.includes('never-log-this'))
  const expired = desktop(); expired.auth.expiresAt = 1
  assert.throws(() => parseDesktop(expired), { code: 'AUTH' })
})

test('desktop credentials are re-read for every request; no refresh or desktop write occurs', async () => {
  let value = desktop(), reads = 0
  const session = new WorkBuddySession('cn', () => undefined, () => {}, async () => { throw new Error('no network expected') }, async () => { reads++; return value })
  const first = await session.authenticate()
  assert.equal(first.apiKey, 'desktop-secret')
  assert.equal(first.headers['X-User-Id'], 'user')
  assert.equal(first.headers['X-Enterprise-Id'], 'team')
  assert.equal(first.headers['X-API-Key'], undefined)
  value = desktop('rotated-secret')
  assert.equal((await session.authenticate()).apiKey, 'rotated-secret')
  assert.equal(reads, 2)
  session.dispose()
})

test('cancelling a request does not wait for a slow credential read', async () => {
  let release
  const session = new WorkBuddySession('cn', () => undefined, () => {}, fetch,
    () => new Promise(resolve => { release = resolve }))
  const controller = new AbortController()
  const pending = session.authenticate(controller.signal)
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  await assert.rejects(() => pending, { code: 'ABORTED' })
  release(desktop())
  session.dispose()
})

test('browser sign-in handles encrypted desktop credentials and persists tokens only in DSH credential records', async () => {
  const credentials = store()
  let changed = 0, waiting = true
  const requests = []
  const session = new WorkBuddySession('cn', () => credentials, () => changed++, async (url, init) => {
    requests.push({ url, init })
    if (url.includes('/auth/state')) return envelope({ state: 'pending-state', authUrl: 'https://www.workbuddy.cn/login' })
    if (url.includes('/auth/token?')) return waiting ? Response.json({ code: 11217 }) : envelope({ accessToken: 'browser-secret', refreshToken: 'browser-refresh', expiresIn: 3600, domain: 'tenant' })
    if (url.includes('/login/account')) return envelope({ uid: 'browser-user', enterpriseId: 'enterprise' })
    throw new Error('unexpected URL')
  }, async () => desktop({ $wbEncrypted: 1 }))
  assert.equal((await session.status()).configured, false)
  const start = await session.beginLogin()
  assert.ok(start.url.startsWith('https://www.workbuddy.cn/login?'))
  assert.deepEqual(await session.pollLogin(), { pending: true })
  waiting = false
  const result = await session.pollLogin()
  assert.deepEqual(result, { pending: false })
  assert.ok(!JSON.stringify(result).includes('browser-secret'))
  assert.deepEqual(await session.status(), { configured: true, source: 'browser' })
  const auth = await session.authenticate()
  assert.equal(auth.apiKey, 'browser-secret')
  assert.equal(auth.headers['X-Tenant-Id'], 'enterprise')
  assert.equal(credentials.records.size, 1)
  assert.equal(changed, 1)
  assert.ok(requests.every(request => request.init.redirect === 'error'))
  await session.useDesktop()
  assert.equal(credentials.records.size, 0)
  assert.equal((await session.status()).configured, false)
  session.dispose()
})

test('browser token renewal is serialized, and the refreshed token is stored once', async () => {
  const credentials = store()
  let requests = 0
  const session = new WorkBuddySession('intl', () => credentials, () => {}, async (url, init) => {
    requests++
    assert.equal(url, 'https://www.workbuddy.ai/v2/plugin/auth/token/refresh')
    assert.equal(init.headers['X-Refresh-Token'], 'old-refresh')
    return envelope({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 3600 })
  }, async () => { throw new Error('must not read desktop while browser auth exists') })
  credentials.records.set(session.key, { kind: 'grant', payload: { source: 'browser', access: 'old-access', refresh: 'old-refresh', expires: 1, uid: 'user', domain: 'domain' } })
  const results = await Promise.all([session.authenticate(), session.authenticate(), session.authenticate()])
  assert.deepEqual(results.map(item => item.apiKey), ['new-access', 'new-access', 'new-access'])
  assert.equal(requests, 1)
  assert.equal(credentials.records.get(session.key).payload.refresh, 'new-refresh')
  session.dispose()
})

test('cancelled browser sign-in cannot save a late token; server errors do not reflect secrets', async () => {
  const credentials = store()
  let release
  const session = new WorkBuddySession('cn', () => credentials, () => {}, async url => {
    if (url.includes('/auth/state')) return envelope({ state: 'state', authUrl: 'https://www.workbuddy.cn/login' })
    if (url.includes('/auth/token?')) return await new Promise(resolve => { release = resolve })
    return envelope({ uid: 'user' })
  }, async () => desktop())
  await session.beginLogin()
  const pending = session.pollLogin()
  await new Promise(resolve => setImmediate(resolve))
  session.cancelLogin()
  release(envelope({ accessToken: 'late-secret' }))
  assert.equal((await pending).pending, false)
  assert.equal(credentials.records.size, 0)
  session.dispose()
  const failed = new WorkBuddySession('cn', () => credentials, () => {}, async () => Response.json({ code: 403, msg: 'private-secret' }, { status: 403 }))
  await assert.rejects(() => failed.beginLogin(), error => !error.message.includes('private-secret'))
  failed.dispose()
})

test('WorkBuddy streams DSH tool calls with original names and preserves reasoning in tool history', async () => {
  let captured
  const id = '12345678901234567890123456789012'
  const response = { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id, function: { name: 'placeholder', arguments: '{"path":"a"}' } }] }, finish_reason: 'tool_calls' }] }
  const config = Config({})
  const adapter = new CodeBuddyAdapter(config, {
    baseURL: 'https://copilot.tencent.com/v2', workbuddy: true, providerName: 'WorkBuddy',
    authenticate: async () => ({ apiKey: 'oauth-secret', headers: { Authorization: 'Bearer oauth-secret', 'X-User-Id': 'user' } }),
    fetch: async (_url, init) => {
      captured = { headers: new Headers(init.headers), body: JSON.parse(init.body) }
      response.choices[0].delta.tool_calls[0].function.name = captured.body.tools[0].function.name
      return new Response('data: ' + JSON.stringify(response) + '\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
    },
  })
  const assembler = new BlockAssembler()
  for await (const chunk of adapter.stream({ provider: 'codebuddy-api', model: 'auto', sessionId: 'session',
    tools: [{ name: 'fs.read:file', description: 'read', parameters: { properties: { path: { type: 'string' } } } }],
    messages: [{ role: 'user', content: [{ type: 'text', text: 'read a' }] }],
  })) assembler.push(chunk)
  assert.equal(captured.headers.get('authorization'), 'Bearer oauth-secret')
  assert.equal(captured.headers.get('x-api-key'), null)
  assert.equal(captured.body.messages[0].role, 'system')
  assert.equal(captured.body.tools[0].function.parameters.type, 'object')
  assert.equal(assembler.blocks()[0].name, 'fs.read:file')
  assert.equal(assembler.finish.kind, 'tool-calls')
  const history = workbuddyRequest({ model: 'auto', stream: true, messages: [
    { role: 'assistant', content: null, reasoning_content: 'thinking', tool_calls: [{ type: 'function', id: 'dsh-call-id', function: { name: 'fs.read:file', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'dsh-call-id', content: 'result' },
  ] }, { messages: [] }).body.messages.slice(1)
  assert.equal(history[0].reasoning, 'thinking')
  assert.equal(history[0].reasoning_content, undefined)
  assert.equal(history[0].tool_calls[0].id, history[1].tool_call_id)
  assert.match(history[1].tool_call_id, /^[0-9a-f]{32}$/)
})

test('Remote validates commands and its status reply never contains credential fields', () => {
  const method = REMOTE.methods['codebuddyProvider/command']
  assert.throws(() => method.input().create().parse({ action: 'read-secrets' }))
  assert.deepEqual(method.result.create().parse({ configured: true, access: 'secret' }), { configured: true })
})

test('conversation turn IDs persist across tool steps but repeated user text starts a new turn', () => {
  const user = { role: 'user', content: [{ type: 'text', text: 'continue' }] }
  const reply = { role: 'assistant', content: [{ type: 'text', text: 'done' }] }
  const request = messages => workbuddyRequest({ model: 'auto', stream: true, messages: [] }, { sessionId: 'session', messages }).headers['X-Conversation-Request-ID']
  assert.equal(request([user]), request([user, reply]))
  assert.notEqual(request([user]), request([user, reply, user]))
})
