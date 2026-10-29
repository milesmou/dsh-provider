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
      'conversation.chat.turnTail': { kind: 'list', scope: 'session' },
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
    for (const placement of ['trigger', 'menu', 'option']) {
      const labelMarkup = renderToStaticMarkup(createElement(modelLabel.component, {
        provider: { id: 'workbuddy', name: 'CodeBuddy API' },
        model: { id: 'api-priced', name: 'API model', description: 'x0.11' }, placement,
      }))
      assert.match(labelMarkup, /title="积分倍率 x0.11"/)
      assert.match(labelMarkup, />x0.11<\/span>/)
    }
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

    const creditsEntry = ctx.slots.entries('conversation.session.header.utilities').find(entry => entry.options.id === 'workbuddy-credits')
    const creditListeners = new Set()
    let creditProvider = 'workbuddy'
    let creditLoad = async () => ({ enabled: true, mode: 'api', sessionUsed: 0.03, accountRemain: 79.97, updatedAt: 1234 })
    const creditProps = { sessionId: 'one', subscribeCredits: creditsEntry.inject().subscribeCredits, selection: () => ({
      getSnapshot: () => ({ current: { provider: creditProvider } }),
      subscribe: listener => { creditListeners.add(listener); return () => creditListeners.delete(listener) },
    }), credits: async () => creditLoad() }
    let creditBadge
    try {
      await act(async () => { creditBadge = create(createElement(creditsEntry.component, creditProps)) })
      assert.match(JSON.stringify(creditBadge.toJSON()), /本会话消耗：0.03/)
      assert.match(JSON.stringify(creditBadge.toJSON()), /剩余 79.97/)
      assert.equal(creditBadge.root.findByProps({ 'aria-label': 'CodeBuddy API 积分' }).props.title.includes('更新时间'), true)
      assert.match(creditBadge.root.findByProps({ 'aria-label': 'CodeBuddy API 积分' }).props.title, /生成会话标题、上下文压缩等后台请求/)
      creditLoad = async () => ({ enabled: true, mode: 'api', sessionUsed: 1.63, accountRemain: 78.37 })
      await act(async () => { ctx.emit('dsh-provider/credits-updated', 'two') })
      assert.equal(creditBadge.root.findAllByType('span')[1].children.join(''), '会话总计 0.03')
      await act(async () => { ctx.emit('dsh-provider/credits-updated', 'one') })
      assert.equal(creditBadge.root.findAllByType('span')[1].children.join(''), '会话总计 1.63', 'a settled turn refreshes the matching header without waiting for its polling interval')
      let finishOldTotal
      creditLoad = () => new Promise(resolve => { finishOldTotal = resolve })
      await act(async () => { ctx.emit('dsh-provider/credits-updated', 'one') })
      creditLoad = async () => ({ enabled: true, mode: 'api', sessionUsed: 2, accountRemain: 78 })
      await act(async () => { ctx.emit('dsh-provider/credits-updated', 'one') })
      await act(async () => { finishOldTotal({ enabled: true, mode: 'api', sessionUsed: 1.63, accountRemain: 78.37 }) })
      assert.equal(creditBadge.root.findAllByType('span')[1].children.join(''), '会话总计 2', 'a notification during an in-flight read queues a fresh total')
      creditLoad = async () => ({ enabled: true, mode: 'api', sessionUsed: 0.03, accountRemain: 79.97, stale: true, issue: '余额更新失败' })
      await act(async () => { creditBadge.root.findByProps({ 'aria-label': '刷新余额' }).props.onClick({ stopPropagation() {} }) })
      assert.match(JSON.stringify(creditBadge.toJSON()), /（缓存）/)
      creditLoad = async () => ({ enabled: true, mode: 'api', issue: '请保存有效密钥' })
      await act(async () => { creditBadge.root.findByProps({ 'aria-label': '刷新余额' }).props.onClick({ stopPropagation() {} }) })
      assert.match(JSON.stringify(creditBadge.toJSON()), /本会话消耗：—/)
      assert.match(JSON.stringify(creditBadge.toJSON()), /剩余不可用/)
      let finishCredits
      creditLoad = () => new Promise(resolve => { finishCredits = resolve })
      await act(async () => { creditBadge.root.findByProps({ 'aria-label': '刷新余额' }).props.onClick({ stopPropagation() {} }) })
      creditProvider = 'codex'
      await act(async () => { creditListeners.forEach(listener => listener()) })
      assert.equal(creditBadge.toJSON(), null)
      creditLoad = async () => ({ enabled: true, mode: 'api', sessionUsed: 0, accountRemain: 22 })
      creditProvider = 'workbuddy'
      await act(async () => { creditListeners.forEach(listener => listener()) })
      await act(async () => { finishCredits({ enabled: true, mode: 'api', sessionUsed: 99, accountRemain: 1 }) })
      assert.match(JSON.stringify(creditBadge.toJSON()), /剩余 22/)
      assert.doesNotMatch(JSON.stringify(creditBadge.toJSON()), /本会话消耗：99/)
    } finally { if (creditBadge) await act(async () => creditBadge.unmount()) }
    assert.equal(creditListeners.size, 0)

    const turnEntries = ctx.slots.entries('conversation.chat.turnTail')
    assert.deepEqual(turnEntries.map(entry => entry.options.id), ['workbuddy-turn-credits'])
    assert.ok(ctx.typert.remotes.get('workbuddyProvider/turnCredits'))
    const turnEntry = turnEntries[0]
    const turnCalls = []
    let turnLoad = async () => ({ tracked: true, used: 0.000001, partial: false })
    const turnProps = { sessionId: 'one', turn: { turn: 1, status: 'open' },
      turnCredits: async (...args) => { turnCalls.push(args); return turnLoad() } }
    let turnBadge
    try {
      await act(async () => { turnBadge = create(createElement(turnEntry.component, turnProps)) })
      assert.equal(turnBadge.toJSON(), null)
      assert.deepEqual(turnCalls, [])
      const closed = { ...turnProps, turn: { turn: 1, status: 'closed' } }
      await act(async () => { turnBadge.update(createElement(turnEntry.component, closed)) })
      assert.match(JSON.stringify(turnBadge.toJSON()), /本轮消耗 0.000001 积分/)
      assert.match(turnBadge.root.findByProps({ 'aria-label': '本轮积分消耗' }).props.title, /不含生成会话标题、上下文压缩等后台扣费/)
      assert.deepEqual(turnCalls, [['one', 1]])
      // A newer turn can lack complete provider data without turning it into zero use.
      turnLoad = async () => ({ tracked: true, used: 0.03, partial: true })
      await act(async () => { turnBadge.update(createElement(turnEntry.component, { ...closed, turn: { turn: 2, status: 'closed' } })) })
      assert.match(JSON.stringify(turnBadge.toJSON()), /本轮已知消耗 0.03 积分（部分）/)
      turnLoad = async () => ({ tracked: true, partial: true })
      await act(async () => { turnBadge.update(createElement(turnEntry.component, { ...closed, turn: { turn: 3, status: 'closed' } })) })
      assert.match(JSON.stringify(turnBadge.toJSON()), /本轮积分不可用/)
      // Explicit zero credit remains distinct from absent data.
      turnLoad = async () => ({ tracked: true, used: 0, partial: false })
      await act(async () => { turnBadge.update(createElement(turnEntry.component, { ...closed, turn: { turn: 4, status: 'closed' } })) })
      assert.match(JSON.stringify(turnBadge.toJSON()), /本轮消耗 0 积分/)
      let finishTurn
      turnLoad = () => new Promise(resolve => { finishTurn = resolve })
      await act(async () => { turnBadge.update(createElement(turnEntry.component, { ...closed, turn: { turn: 5, status: 'closed' } })) })
      turnLoad = async () => ({ tracked: false })
      await act(async () => { turnBadge.update(createElement(turnEntry.component, { ...closed, sessionId: 'codex-session' })) })
      await act(async () => { finishTurn({ tracked: true, used: 99, partial: false }) })
      assert.equal(turnBadge.toJSON(), null, 'late replies never cross session or turn boundaries')
      turnLoad = async () => { throw new Error('private-host-detail') }
      await act(async () => { turnBadge.update(createElement(turnEntry.component, { ...closed, sessionId: 'other' })) })
      assert.equal(turnBadge.toJSON(), null, 'a failed lookup cannot attribute WorkBuddy spend to an unknown provider')
    } finally { if (turnBadge) await act(async () => turnBadge.unmount()) }

    const workbuddyRuntime = [...ctx.registry.values()].find(runtime => runtime.name === 'workbuddy-component-settings')
    await [...workbuddyRuntime.fibers][0].dispose()
    assert.deepEqual(ctx.slots.entries(cardsSlot).map(entry => entry.options.id), ['codex'])
    assert.deepEqual(ctx.slots.entries('conversation.chat.turnTail'), [])
    assert.ok(ctx.slots.entries('conversation.input.model.label').includes(modelLabel))
    assert.ok(ctx.slots.entries('conversation.input.model.label').some(entry => entry.component === builtIn))
    await providerFiber.dispose()
    assert.equal(ctx.typert.remotes.get('workbuddyProvider/command'), undefined)
    assert.equal(ctx.typert.remotes.get('workbuddyProvider/turnCredits'), undefined)
    assert.equal(ctx.typert.remotes.get('codexProvider/command'), undefined)
    assert.equal(ctx.typert.remotes.get('codexProvider/quota'), undefined)
    assert.deepEqual(ctx.slots.entries('settings.section'), [])
    assert.deepEqual(ctx.slots.entries('conversation.input.model.label').map(entry => entry.component), [builtIn])
    await ctx.plugin(provider).await()
    await new Promise(setImmediate)
    assert.deepEqual(ctx.slots.entries(cardsSlot).map(entry => entry.options.id).sort(), ['codex', 'workbuddy'])
    assert.deepEqual(ctx.slots.entries('conversation.chat.turnTail').map(entry => entry.options.id), ['workbuddy-turn-credits'])
  } finally { await ctx.fiber.dispose() }
})
