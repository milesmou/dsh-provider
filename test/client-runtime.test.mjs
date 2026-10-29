import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { Context } from '@deepseek-ai/cordis'
import * as gateway from '@deepseek-ai/dsh-api-gateway/client'
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
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
const cardsSlot = 'dsh-provider.settings.cards'

test('the dedicated settings page and model labels share one Remote and survive disposal and reload', async () => {
  const ctx = new Context()
  try {
    new TypertRegistry(ctx)
    ctx.provide('connection', { interactions: 'none', rpc: { open: () => {} }, generation: { getSnapshot: () => undefined } })
    ctx.provide('modelDirectories', { directoryFor: () => undefined })
    new renderer.SlotRegistry(ctx)
    ctx.slots.register({ name: 'root', children: {
      'settings.section': { kind: 'list', scope: 'root' },
      'settings.models.footer': { kind: 'list', scope: 'root' },
      'conversation.input.model.label': { kind: 'single', scope: 'session' },
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
    } }, () => null)
    // DSH's built-in DeepSeek label occupies the slot's default priority.
    const builtIn = () => null
    ctx.slots.register({ name: 'conversation.input.model.label' }, builtIn)
    await ctx.plugin(gateway).await()
    await ctx.remote.$mount(SETTINGS)
    const providerFiber = ctx.plugin(provider)
    await providerFiber.await()
    await new Promise(setImmediate)

    const cards = ctx.slots.entries(cardsSlot)
    assert.deepEqual(cards.map(entry => entry.options.id).sort(), ['codex', 'workbuddy'])
    assert.deepEqual(ctx.slots.entries('settings.models.footer'), [])
    const page = ctx.slots.entries('settings.section').find(entry => entry.options.id === 'dsh-provider-models')
    assert.equal(page.options.label, '模型扩展')
    const pageMarkup = renderToStaticMarkup(createElement(page.component, {
      renderSlot: key => ctx.slots.entries(key).map(entry => createElement(entry.component, { key: entry.options.id, ...entry.inject() })),
    }))
    assert.match(pageMarkup, /模型扩展/)
    assert.match(pageMarkup, /WorkBuddy 组件/)
    assert.match(pageMarkup, /Codex 组件/)
    assert.ok(ctx.typert.remotes.get('workbuddyProvider/command'))
    assert.ok(ctx.typert.remotes.get('codexProvider/command'))
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
    const modelLabel = labels.find(entry => entry.component !== builtIn)
    for (const placement of ['trigger', 'menu']) {
      const labelMarkup = renderToStaticMarkup(createElement(modelLabel.component, {
        provider: { id: 'codex' }, model: { id: 'gpt-6.1-sol', name: 'GPT-6.1-Sol' }, placement,
      }))
      assert.match(labelMarkup, /<svg[^>]*fill="currentColor"/)
      assert.ok(labelMarkup.indexOf('<svg') < labelMarkup.indexOf('GPT-6.1-Sol'))
    }
    const otherLabel = renderToStaticMarkup(createElement(modelLabel.component, {
      provider: { id: 'other' }, model: { id: 'gpt-6.1-sol' },
    }))
    assert.doesNotMatch(otherLabel, /<svg/)

    const workbuddyRuntime = [...ctx.registry.values()].find(runtime => runtime.name === 'workbuddy-component-settings')
    await [...workbuddyRuntime.fibers][0].dispose()
    assert.deepEqual(ctx.slots.entries(cardsSlot).map(entry => entry.options.id), ['codex'])
    assert.ok(ctx.slots.entries('conversation.input.model.label').includes(modelLabel))
    assert.ok(ctx.slots.entries('conversation.input.model.label').some(entry => entry.component === builtIn))
    await providerFiber.dispose()
    assert.equal(ctx.typert.remotes.get('workbuddyProvider/command'), undefined)
    assert.equal(ctx.typert.remotes.get('codexProvider/command'), undefined)
    assert.deepEqual(ctx.slots.entries('settings.section'), [])
    assert.deepEqual(ctx.slots.entries('conversation.input.model.label').map(entry => entry.component), [builtIn])
    await ctx.plugin(provider).await()
    await new Promise(setImmediate)
    assert.deepEqual(ctx.slots.entries(cardsSlot).map(entry => entry.options.id).sort(), ['codex', 'workbuddy'])
  } finally { await ctx.fiber.dispose() }
})
