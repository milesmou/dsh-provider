import test from 'node:test'
import assert from 'node:assert/strict'
import { mountClient } from '../../../client-harness.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { REMOTE } from '../../../lib/components/codex/remote.js'

test('Codex settings uses the shared package Remote and exposes only status and refresh', async t => {
  const calls = []
  const { ctx, fiber } = await mountClient(async (endpoint, args) => {
    if (endpoint === 'settings/describe') return { ok: true, value: { namespaces: [{ ns: 'dsh-provider-codex' }] } }
    assert.equal(endpoint, 'codexProvider/command')
    calls.push(args.action)
    return { ok: true, value: { configured: true, models: 3, source: 'live' } }
  })
  t.after(() => ctx.fiber.dispose())
  assert.ok(ctx.typert.remotes.get('workbuddyProvider/command'))
  assert.ok(ctx.typert.remotes.get('codexProvider/command'))
  const [registration] = ctx.slots.entries('dsh-provider.settings.cards')
  assert.equal(registration.options.id, 'codex')
  const { actions } = registration.inject()
  assert.deepEqual(await actions.command('status'), { configured: true, models: 3, source: 'live' })
  await actions.command('refresh')
  assert.deepEqual(calls, ['status', 'refresh'])
  const markup = renderToStaticMarkup(createElement(registration.component, { actions }))
  assert.match(markup, /<strong>Codex<\/strong>/)
  assert.match(markup, /codex login/)
  assert.match(markup, /刷新登录态和模型/)
  assert.ok(!markup.includes('type="password"'))
  assert.ok(!markup.includes('access_token'))
  await fiber.dispose()
  assert.equal(ctx.typert.remotes.get('codexProvider/command'), undefined)
  assert.equal(ctx.typert.remotes.get('workbuddyProvider/command'), undefined)
})

test('Codex Remote rejects credential-reading commands and strips secrets from status replies', () => {
  const method = REMOTE.methods['codexProvider/command']
  assert.throws(() => method.input().create().parse({ action: 'read-secrets' }))
  const reply = method.result.create().parse({ configured: true, models: 3, access_token: 'secret', refresh_token: 'secret' })
  assert.deepEqual(reply, { configured: true, models: 3 })
})
