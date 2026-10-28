import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as host from '../../../lib/index.js'

// Exercise the same wrapper used by DSH's browser plugin loader.
let client
runInNewContext(await readFile(new URL('../../../lib/client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load: ({ id, factory }) => {
    assert.equal(id, 'dsh-provider')
    client = factory(createRequire(import.meta.url))
  } } },
})

test('saved credential changes reach the next model request without a plugin restart', async t => {
  const headers = []
  const server = createServer((request, response) => {
    // Record only the chat calls under test; the always-on catalog discovery
    // hits /models and is not part of this assertion.
    if ((request.url ?? '').endsWith('/chat/completions')) headers.push(request.headers.authorization)
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    response.end('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: 'ok' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const ctx = new Context()
  const keys = new Map([['DSH_PROVIDER_WORKBUDDY_API_KEY', 'ck_first']])
  let fallbackSource = 'env'
  const refs = []
  let recordingRefs = false
  ctx.provide('credentials', { resolve: async ref => {
    if (recordingRefs) refs.push(ref)
    const value = keys.get(ref)
    return value ? { value, source: 'file' } : { value: 'ck_stale_ambient', source: fallbackSource }
  } })
  ctx.provide('launchEnvironment', createLaunchEnvironmentSnapshot([{ source: 'process', values: { DSH_PROVIDER_WORKBUDDY_API_KEY: 'ck_stale_ambient' } }]))
  const runtime = ctx.plugin(LlmRuntime)
  const fiber = ctx.plugin(host, { workbuddy: { baseURL: `http://127.0.0.1:${server.address().port}/v2` } })
  await runtime.await()
  await fiber.await()
  const uid = fiber.uid
  const run = async () => {
    recordingRefs = true
    try {
      const chunks = []
      for await (const chunk of ctx.llm.stream({ provider: 'workbuddy', model: 'auto', messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }] })) chunks.push(chunk)
      return chunks.at(-1)
    } finally { recordingRefs = false }
  }
  try {
    assert.equal((await run()).reason.kind, 'stop')
    keys.set('DSH_PROVIDER_WORKBUDDY_API_KEY', 'ck_second')
    assert.equal((await run()).reason.kind, 'stop')
    assert.deepEqual(headers, ['Bearer ck_first', 'Bearer ck_second'])
    assert.deepEqual(refs, ['DSH_PROVIDER_WORKBUDDY_API_KEY', 'DSH_PROVIDER_WORKBUDDY_API_KEY'])
    assert.equal(fiber.uid, uid)
    keys.clear()
    for (const source of ['env', 'user-env', 'project-env']) {
      fallbackSource = source
      const failure = (await run()).reason.failure
      assert.equal(failure.code, 'MISSING_CREDENTIAL')
      assert.ok(!failure.message.includes('ck_stale_ambient'))
    }
    assert.equal(headers.length, 2)
  } finally { await ctx.fiber.dispose() }
})

async function clientFixture({ configured = false, writable = true, writeRefused = false, source = 'file' } = {}) {
  const calls = []
  const mounts = []
  let registration
  let component
  let saved = configured
  let selection = { mode: 'api', workbuddyRegion: 'cn' }
  const ctx = {
    effect: () => {},
    plugin: plugin => { mounts.push(plugin.apply(ctx)) },
    inject: (services, callback) => { callback(ctx) },
    get: () => undefined,
    remote: {
      $mount: async () => () => {},
      settings: {
        describe: async () => ({ ok: true, value: { writable: true, namespaces: [{ns: 'dsh-provider', value: { workbuddy: selection }, revision: 1}] } }),
        update: async (ns, value, revision) => {
          assert.equal(ns, 'dsh-provider'); assert.equal(revision, 1)
          selection = { ...selection, ...value.workbuddy }
          return { ok: true }
        },
        mutate: () => { throw new Error('Secrets must not be written into settings') },
      },
      workbuddyProvider: { command: async action => {
        assert.equal(action, 'status')
        return { ok: true, value: { configured: false, issue: '本机凭据已加密' } }
      } },
      credentials: {
        describe: async refs => ({ ok: true, value: { [refs[0]]: { configured: saved, writable, source } } }),
        set: async (ref, value) => {
          calls.push({ ref, value })
          if (writeRefused) return { ok: false, error: { message: value } }
          saved = true
          source = 'file'
          return { ok: true }
        },
      },
    },
    slots: {
      inject: (slot, register) => { register() },
      register: (options, card) => {
        if (options.name === 'settings.models.footer') { registration = options; component = card }
        return () => {}
      },
    },
  }
  await client.apply(ctx)
  await Promise.all(mounts)
  return { ...registration.inject(), calls, component }
}

test('settings card stores a key via credentials Remote and exposes only redacted state', async () => {
  const fixture = await clientFixture()
  assert.deepEqual({ ...await fixture.actions.status() }, { configured: false, writable: true })
  await fixture.actions.save('  ck_new_key  ')
  assert.deepEqual(fixture.calls, [{ ref: 'DSH_PROVIDER_WORKBUDDY_API_KEY', value: 'ck_new_key' }])
  const status = await fixture.actions.status()
  assert.deepEqual({ ...status }, { configured: true, writable: true })
  assert.ok(!JSON.stringify(status).includes('ck_new_key'))
})

test('settings ignores ambient keys and lets the user save a stored key instead', async () => {
  for (const source of ['env', 'user-env', 'project-env']) {
    const fixture = await clientFixture({ configured: true, source })
    assert.deepEqual({ ...await fixture.actions.status() }, { configured: false, writable: true })
    await fixture.actions.save('ck_saved')
    assert.deepEqual({ ...await fixture.actions.status() }, { configured: true, writable: true })
  }
})

test('switching to WorkBuddy stores only mode and region and reads its dedicated status namespace', async () => {
  const fixture = await clientFixture()
  await fixture.connection.select('workbuddy', 'intl')
  const state = await fixture.connection.status()
  assert.equal(state.mode, 'workbuddy')
  assert.equal(state.region, 'intl')
  assert.equal(state.login.configured, false)
  assert.equal(fixture.calls.length, 0)
})

test('context window choice persists through the settings namespace', async () => {
  const fixture = await clientFixture()
  assert.equal((await fixture.connection.status()).context, 'max')
  await fixture.connection.context('300k')
  assert.equal((await fixture.connection.status()).context, '300k')
  await fixture.connection.context('max')
  assert.equal((await fixture.connection.status()).context, 'max')
})

test('settings card rejects invalid keys and does not reflect server error secrets', async () => {
  const fixture = await clientFixture({ writeRefused: true })
  await assert.rejects(() => fixture.actions.save(''), /Invalid credential/)
  await assert.rejects(() => fixture.actions.save('ck_bad\nkey'), /Invalid credential/)
  assert.equal(fixture.calls.length, 0)
  await assert.rejects(() => fixture.actions.save('ck_private'), error => {
    assert.ok(!error.message.includes('ck_private'))
    return true
  })
})

test('settings card renders a masked API key input with browser autofill disabled', async () => {
  const fixture = await clientFixture()
  const html = renderToStaticMarkup(createElement(fixture.component, { actions: fixture.actions }))
  assert.match(html, /type="password"/)
  assert.match(html, /autoComplete="new-password"/)
  assert.match(html, /保存密钥/)
  assert.ok(!html.includes('DSH_PROVIDER_WORKBUDDY_API_KEY'))
  assert.ok(!html.includes('30 分钟'))
})
