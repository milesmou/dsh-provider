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
import { act, create } from 'react-test-renderer'
import { parseQuota } from '../lib/components/codex/quota.js'

async function loadBrowserBundle(file) {
  let result
  runInNewContext(await readFile(file, 'utf8'), {
    setTimeout, clearTimeout,
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
    assert.match(pageMarkup, /<strong>WorkBuddy<\/strong>/)
    assert.match(pageMarkup, /<strong>Codex<\/strong>/)
    assert.ok(ctx.typert.remotes.get('workbuddyProvider/command'))
    assert.ok(ctx.typert.remotes.get('codexProvider/command'))
    assert.ok(ctx.typert.remotes.get('codexProvider/quota'))
    assert.equal(typeof ctx.remote.settings.describe, 'function')
    assert.equal(typeof ctx.remote.credentials.set, 'function')
    const workbuddy = cards.find(entry => entry.options.id === 'workbuddy')
    const markup = renderToStaticMarkup(createElement(workbuddy.component, workbuddy.inject()))
    assert.match(markup, /<strong>WorkBuddy<\/strong>/)
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
      assert.match(labelMarkup, /<svg/)
      assert.ok(labelMarkup.indexOf('<svg') < labelMarkup.indexOf('GPT-6.1-Sol'))
    }
    const otherLabel = renderToStaticMarkup(createElement(modelLabel.component, {
      provider: { id: 'other' }, model: { id: 'gpt-6.1-sol' },
    }))
    assert.doesNotMatch(otherLabel, /<svg/)

    const quotaEntry = ctx.slots.entries('conversation.session.header.utilities').find(entry => entry.options.id === 'codex-quota')
    assert.equal(typeof quotaEntry.inject().read, 'function')
    const listeners = new Set()
    let selected = 'workbuddy'
    const source = { getSnapshot: () => ({ current: { provider: selected } }),
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) } }
    const calls = []
    const quotaView = used => parseQuota({ rate_limit: {
      primary_window: { used_percent: used, limit_window_seconds: 18000, reset_at: 2000000000 },
      secondary_window: { used_percent: 8, limit_window_seconds: 604800 },
    } })
    let load = async () => quotaView(26)
    const props = { sessionId: 'one', selection: id => id === 'one' ? source : {
      getSnapshot: () => ({ current: { provider: 'workbuddy' } }), subscribe: () => () => {},
    }, read: async force => { calls.push(force); return load() } }
    let badge
    const choose = async provider => { await act(async () => { selected = provider; listeners.forEach(listener => listener()) }) }
    try {
      await act(async () => { badge = create(createElement(quotaEntry.component, props)) })
      assert.equal(badge.toJSON(), null)
      assert.deepEqual(calls, [])
      await choose('codex')
      assert.match(badge.root.findByType('span').children.join(''), /^5h 74% · 周 92%$/)
      const refresh = badge.root.findByProps({ 'aria-label': 'Codex 剩余额度' })
      assert.match(refresh.props.title, /重置/)
      load = async () => quotaView(40)
      await act(async () => { refresh.props.onClick({ stopPropagation() {} }) })
      assert.deepEqual(calls, [false, true])
      assert.match(JSON.stringify(badge.toJSON()), /5h 60%/)

      await act(async () => { badge.update(createElement(quotaEntry.component, { ...props, sessionId: 'two' })) })
      assert.equal(badge.toJSON(), null)
      assert.deepEqual(calls, [false, true])
      await act(async () => { badge.update(createElement(quotaEntry.component, props)) })
      let finishOld
      await choose('workbuddy')
      load = () => new Promise(resolve => { finishOld = resolve })
      await choose('codex')
      await choose('workbuddy')
      load = async () => quotaView(26)
      await choose('codex')
      await act(async () => { finishOld(quotaView(99)) })
      assert.match(JSON.stringify(badge.toJSON()), /5h 74%/)
    } finally { if (badge) await act(async () => badge.unmount()) }
    assert.equal(listeners.size, 0)

    const workbuddyRuntime = [...ctx.registry.values()].find(runtime => runtime.name === 'workbuddy-component-settings')
    await [...workbuddyRuntime.fibers][0].dispose()
    assert.deepEqual(ctx.slots.entries(cardsSlot).map(entry => entry.options.id), ['codex'])
    assert.ok(ctx.slots.entries('conversation.input.model.label').includes(modelLabel))
    assert.ok(ctx.slots.entries('conversation.input.model.label').some(entry => entry.component === builtIn))
    await providerFiber.dispose()
    assert.equal(ctx.typert.remotes.get('workbuddyProvider/command'), undefined)
    assert.equal(ctx.typert.remotes.get('codexProvider/command'), undefined)
    assert.equal(ctx.typert.remotes.get('codexProvider/quota'), undefined)
    assert.deepEqual(ctx.slots.entries('settings.section'), [])
    assert.deepEqual(ctx.slots.entries('conversation.input.model.label').map(entry => entry.component), [builtIn])
    await ctx.plugin(provider).await()
    await new Promise(setImmediate)
    assert.deepEqual(ctx.slots.entries(cardsSlot).map(entry => entry.options.id).sort(), ['codex', 'workbuddy'])
  } finally { await ctx.fiber.dispose() }
})
