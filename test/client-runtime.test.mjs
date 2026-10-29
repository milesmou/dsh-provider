import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { Context } from '@deepseek-ai/cordis'
import * as gateway from '@deepseek-ai/dsh-api-gateway/client'
import SETTINGS from '@deepseek-ai/dsh-api-settings-controller/remote'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

async function loadBrowserBundle(file) {
  let result
  runInNewContext(await readFile(file, 'utf8'), {
    window: { __ModuleLoader__: { load: ({ factory }) => { result = factory(createRequire(import.meta.url)) } } },
  })
  return result
}

const provider = await loadBrowserBundle(new URL('../lib/client.js', import.meta.url))
const renderer = await loadBrowserBundle(new URL('../node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js', import.meta.url))

test('both cards survive the built-in label without duplicating platform Remote registrations', async () => {
  const ctx = new Context()
  try {
    ctx.provide('typert', { remotes: { register: () => () => {} } })
    ctx.provide('connection', { interactions: 'none', rpc: { open: () => {} }, generation: { getSnapshot: () => undefined } })
    ctx.provide('modelDirectories', { directoryFor: () => undefined })
    new renderer.SlotRegistry(ctx)
    ctx.slots.register({ name: 'root', children: {
      'settings.models.footer': { kind: 'list', scope: 'root' },
      'conversation.input.model.label': { kind: 'single', scope: 'session' },
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
    } }, () => null)
    // DSH's built-in DeepSeek label occupies the slot's default priority.
    const builtIn = () => null
    ctx.slots.register({ name: 'conversation.input.model.label' }, builtIn)
    await ctx.plugin(gateway).await()
    await ctx.remote.$mount(SETTINGS)
    await ctx.plugin(provider).await()
    await new Promise(setImmediate)

    const cards = ctx.slots.entries('settings.models.footer')
    assert.deepEqual(cards.map(entry => entry.options.id).sort(), ['codex', 'workbuddy'])
    assert.equal(typeof ctx.remote.settings.describe, 'function')
    assert.equal(typeof ctx.remote.credentials.set, 'function')
    const workbuddy = cards.find(entry => entry.options.id === 'workbuddy')
    const markup = renderToStaticMarkup(createElement(workbuddy.component, workbuddy.inject()))
    assert.match(markup, /WorkBuddy 组件/)
    assert.match(markup, /WorkBuddy 接入方式/)
    assert.match(markup, /上下文窗口/)
    const labels = ctx.slots.entries('conversation.input.model.label')
    assert.equal(labels.length, 2)
    assert.ok(labels.some(entry => entry.component === builtIn))
    assert.notEqual(labels[0].options.priority ?? 0, labels[1].options.priority ?? 0)

    const workbuddyRuntime = [...ctx.registry.values()].find(runtime => runtime.name === 'workbuddy-component-settings')
    await [...workbuddyRuntime.fibers][0].dispose()
    assert.deepEqual(ctx.slots.entries('settings.models.footer').map(entry => entry.options.id), ['codex'])
    assert.ok(ctx.slots.entries('conversation.input.model.label').some(entry => entry.component === builtIn))
  } finally { await ctx.fiber.dispose() }
})
