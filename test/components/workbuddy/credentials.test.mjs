import { mockCodeBuddyGateway } from '../../../harness-setup.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { mountClient } from '../../../client-harness.mjs'
import * as host from '../../../lib/index.js'

test('saved credential changes reach the next model request without a plugin restart', async t => {
  const headers = []
  const server = createServer((request, response) => {
    // Record only the chat calls under test; the always-on catalog discovery
    // hits /v3/config and is not part of this assertion.
    if ((request.url ?? '').endsWith('/chat/completions')) headers.push(request.headers.authorization)
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    response.end('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: 'ok' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  mockCodeBuddyGateway(t, `http://127.0.0.1:${server.address().port}`)
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
  const fiber = ctx.plugin(host, { workbuddy: {} })
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

async function clientFixture(t, { configured = false, writable = true, writeRefused = false, source = 'file' } = {}) {
  const calls = []
  let saved = configured
  let selection = { mode: 'api', workbuddyRegion: 'cn' }
  const { ctx } = await mountClient(async (endpoint, args) => {
    switch (endpoint) {
      case 'settings/describe':
        return { ok: true, value: { writable: true, namespaces: [{ ns: 'dsh-provider', value: { workbuddy: selection }, revision: 1 }] } }
      case 'settings/update': {
        const { ns, patch: value, expectedRevision: revision } = args
          assert.equal(ns, 'dsh-provider'); assert.equal(revision, 1)
          selection = { ...selection, ...value.workbuddy }
          return { ok: true }
      }
      case 'workbuddyProvider/command':
        assert.equal(args.action, 'status')
        return { ok: true, value: { configured: false, issue: '本机凭据已加密' } }
      case 'credentials/describe':
        return { ok: true, value: { [args.refs[0]]: { configured: saved, writable, source } } }
      case 'credentials/set': {
        const { ref, value } = args
          calls.push({ ref, value })
        if (writeRefused) return { ok: false, error: { code: 'credential/rejected', message: value, details: { ref } } }
          saved = true
          source = 'file'
          return { ok: true }
      }
      default: throw new Error('Unexpected credential test endpoint')
    }
  })
  t.after(() => ctx.fiber.dispose())
  const registration = ctx.slots.entries('dsh-provider.settings.cards').find(entry => entry.options.id === 'workbuddy')
  return { ...registration.inject(), calls, component: registration.component }
}

test('settings card stores a key via credentials Remote and exposes only redacted state', async t => {
  const fixture = await clientFixture(t)
  assert.deepEqual({ ...await fixture.actions.status() }, { configured: false, writable: true })
  await fixture.actions.save('  ck_new_key  ')
  assert.deepEqual(fixture.calls, [{ ref: 'DSH_PROVIDER_WORKBUDDY_API_KEY', value: 'ck_new_key' }])
  const status = await fixture.actions.status()
  assert.deepEqual({ ...status }, { configured: true, writable: true })
  assert.ok(!JSON.stringify(status).includes('ck_new_key'))
})

test('settings ignores ambient keys and lets the user save a stored key instead', async t => {
  for (const source of ['env', 'user-env', 'project-env']) {
    const fixture = await clientFixture(t, { configured: true, source })
    assert.deepEqual({ ...await fixture.actions.status() }, { configured: false, writable: true })
    await fixture.actions.save('ck_saved')
    assert.deepEqual({ ...await fixture.actions.status() }, { configured: true, writable: true })
  }
})

test('switching to WorkBuddy stores only mode and region and reads its dedicated status namespace', async t => {
  const fixture = await clientFixture(t)
  await fixture.connection.select('workbuddy', 'intl')
  const state = await fixture.connection.status()
  assert.equal(state.mode, 'workbuddy')
  assert.equal(state.region, 'intl')
  assert.equal(state.login.configured, false)
  assert.equal(fixture.calls.length, 0)
})

test('context window choice persists through the settings namespace', async t => {
  const fixture = await clientFixture(t)
  assert.equal((await fixture.connection.status()).context, 'middle')
  await fixture.connection.context('light')
  assert.equal((await fixture.connection.status()).context, 'light')
  await fixture.connection.context('max')
  assert.equal((await fixture.connection.status()).context, 'max')
})

test('settings card rejects invalid keys and does not reflect server error secrets', async t => {
  const fixture = await clientFixture(t, { writeRefused: true })
  await assert.rejects(() => fixture.actions.save(''), /Invalid credential/)
  await assert.rejects(() => fixture.actions.save('ck_bad\nkey'), /Invalid credential/)
  assert.equal(fixture.calls.length, 0)
  await assert.rejects(() => fixture.actions.save('ck_private'), error => {
    assert.ok(!error.message.includes('ck_private'))
    return true
  })
})

test('settings card renders a masked API key input with browser autofill disabled', async t => {
  const fixture = await clientFixture(t)
  const html = renderToStaticMarkup(createElement(fixture.component, { actions: fixture.actions }))
  assert.match(html, /type="password"/)
  assert.match(html, /autoComplete="new-password"/)
  assert.match(html, /保存密钥/)
  assert.ok(!html.includes('DSH_PROVIDER_WORKBUDDY_API_KEY'))
  assert.ok(!html.includes('30 分钟'))
})
