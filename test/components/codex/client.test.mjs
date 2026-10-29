import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { REMOTE } from '../../../lib/components/codex/remote.js'

let client
runInNewContext(await readFile(new URL('../../../lib/client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load: ({ factory }) => { client = factory(createRequire(import.meta.url)) } } },
})

test('Codex settings uses the shared package Remote and exposes only status and refresh', async () => {
  const mounts = [], descriptors = [], calls = []
  let registration, component, disposed = false
  const effects = []
  const ctx = {
    effect: callback => { effects.push(callback) },
    plugin: plugin => { const pending = plugin.name === 'codex-component-settings' ? Promise.resolve(plugin.apply(ctx)) : Promise.resolve(); mounts.push(pending); return { await: () => pending } },
    inject: (_services, callback) => callback(ctx),
    remote: {
      $mount: async remote => { descriptors.push(remote); return () => { disposed = true } },
      codexProvider: { command: async action => { calls.push(action); return { ok: true, value: { configured: true, models: 3, source: 'live' } } } },
    },
    slots: {
      inject: (_slot, callback) => callback(),
      register: (options, card) => { registration = options; component = card; return () => {} },
    },
  }
  await client.apply(ctx)
  await Promise.all(mounts)
  assert.equal(descriptors.length, 1)
  assert.deepEqual([...new Set(descriptors[0].descriptors.map(item => item.namespace))].sort(), ['codexProvider', 'workbuddyProvider'])
  assert.equal(registration.id, 'codex')
  const { actions } = registration.inject()
  assert.deepEqual(await actions.command('status'), { configured: true, models: 3, source: 'live' })
  await actions.command('refresh')
  assert.deepEqual(calls, ['status', 'refresh'])
  const markup = renderToStaticMarkup(createElement(component, { actions }))
  assert.match(markup, /Codex 组件/)
  assert.match(markup, /codex login/)
  assert.match(markup, /刷新登录态和模型/)
  assert.ok(!markup.includes('type="password"'))
  assert.ok(!markup.includes('access_token'))
  effects.forEach(callback => callback()())
  assert.equal(disposed, true)
})

test('Codex Remote rejects credential-reading commands and strips secrets from status replies', () => {
  const method = REMOTE.methods['codexProvider/command']
  assert.throws(() => method.input().create().parse({ action: 'read-secrets' }))
  const reply = method.result.create().parse({ configured: true, models: 3, access_token: 'secret', refresh_token: 'secret' })
  assert.deepEqual(reply, { configured: true, models: 3 })
})
