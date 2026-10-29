import test from 'node:test'
import assert from 'node:assert/strict'
import { mountClient } from '../client-harness.mjs'
import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

const plain = value => JSON.parse(JSON.stringify(value))

async function fixture(t) {
  const cards = new Map(), writes = [], refreshes = []
  const rows = [{ ns: 'dsh-provider', revision: 1, value: { workbuddy: { mode: 'workbuddy', contextWindow: 'max', hiddenModels: ['future-model'] } } },
    { ns: 'dsh-provider-codex', revision: 1, value: { hiddenModels: [] } }]
  const state = { writable: true, refused: false, offline: false }
  const models = [{ id: 'model-one', name: 'First Model', contextWindow: 500000 }, { id: 'model-two', name: 'Second Model', contextWindow: 272000 }]
  const directory = async refresh => { refreshes.push(refresh); return { ok: true, value: { models } } }
  const { ctx } = await mountClient(async (endpoint, args) => {
    if (endpoint === 'settings/describe') {
      if (state.offline) throw new Error('private-server-message')
      return { ok: true, value: { writable: state.writable, namespaces: plain(rows) } }
    }
    if (endpoint === 'settings/update') {
      const { ns, patch, expectedRevision: revision } = args
      const row = rows.find(row => row.ns === ns)
      assert.equal(row.revision, revision)
      writes.push({ ns, patch: plain(patch), revision })
      if (state.refused) return { ok: false, error: { code: 'settings/rejected', message: 'private-server-message', details: { ns } } }
      if (ns === 'dsh-provider') row.value.workbuddy = { ...row.value.workbuddy, ...plain(patch.workbuddy) }
      else row.value = { ...row.value, ...plain(patch) }
      row.revision++
      return { ok: true }
    }
    if (endpoint.endsWith('/models')) return directory(args.refresh)
    if (endpoint === 'codexProvider/command') return { ok: true, value: { configured: true, models: 2 } }
    throw new Error(`Unexpected test endpoint: ${endpoint}`)
  })
  t.after(() => ctx.fiber.dispose())
  for (const entry of ctx.slots.entries('dsh-provider.settings.cards')) {
    cards.set(entry.options.id, { component: entry.component, props: entry.inject() })
  }
  return { cards, rows, writes, state, refreshes }
}

test('component model actions merge only their own visibility field using the latest revision', async t => {
  const f = await fixture(t)
  const workbuddy = f.cards.get('workbuddy').props.modelActions
  const codex = f.cards.get('codex').props.modelActions
  assert.deepEqual(plain((await workbuddy.load(false)).hiddenModels), ['future-model'])
  f.rows[0].value.workbuddy.hiddenModels.push('another-edit')
  f.rows[0].revision++
  assert.deepEqual(plain(await workbuddy.setHidden('model-one', true)), ['another-edit', 'future-model', 'model-one'])
  assert.equal(f.writes[0].revision, 2)
  assert.deepEqual(Object.keys(f.writes[0].patch.workbuddy), ['hiddenModels'])
  assert.equal(f.rows[0].value.workbuddy.mode, 'workbuddy')
  assert.equal(f.rows[0].value.workbuddy.contextWindow, 'max')
  assert.deepEqual(f.rows[1].value.hiddenModels, [])
  await codex.setHidden('model-one', true)
  await workbuddy.setHidden('model-one', false)
  assert.deepEqual(f.rows[0].value.workbuddy.hiddenModels, ['another-edit', 'future-model'])
  assert.deepEqual(f.rows[1].value.hiddenModels, ['model-one'])
  await codex.showAll()
  assert.deepEqual(f.rows[1].value.hiddenModels, [])
  f.state.writable = false
  const count = f.writes.length
  await assert.rejects(() => codex.setHidden('model-two', true))
  assert.equal(f.writes.length, count)
})

test('model management searches, hides and restores rows, refreshes, and keeps failed writes unchanged', async t => {
  const f = await fixture(t)
  const card = f.cards.get('codex')
  let renderer
  try {
    await act(async () => { renderer = create(createElement(card.component, card.props)) })
    const root = renderer.root
    const summary = () => root.findByType('summary').findByType('span').children.join('')
    const toggle = () => root.findByProps({ 'aria-label': 'Codex 显示 First Model (model-one)' })
    assert.match(summary(), /显示 2\/2/)
    const search = root.findByProps({ 'aria-label': 'Codex 搜索模型' })
    await act(async () => { search.props.onChange({ target: { value: 'MODEL-ONE' } }) })
    assert.equal(root.findByProps({ 'aria-label': 'Codex 模型列表' }).findAllByType('li').length, 1)
    await act(async () => { toggle().props.onClick() })
    assert.equal(toggle().props['aria-checked'], false)
    assert.match(summary(), /显示 1\/2 · 已隐藏 1/)
    assert.deepEqual(f.rows[1].value.hiddenModels, ['model-one'])
    assert.deepEqual(f.rows[0].value.workbuddy.hiddenModels, ['future-model'])
    const button = text => root.findAllByType('button').find(button => button.children.includes(text))
    await act(async () => { button('刷新列表').props.onClick() })
    assert.equal(f.refreshes.at(-1), true)
    assert.equal(toggle().props['aria-checked'], false)
    await act(async () => { button('全部显示').props.onClick() })
    assert.equal(toggle().props['aria-checked'], true)
    f.state.refused = true
    await act(async () => { toggle().props.onClick() })
    assert.equal(toggle().props['aria-checked'], true)
    assert.deepEqual(f.rows[1].value.hiddenModels, [])
    assert.match(root.findByProps({ role: 'alert' }).children.join(''), /保存模型显示设置失败/)
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /private-server-message/)
    f.state.writable = false
    f.state.refused = false
    await act(async () => { button('刷新列表').props.onClick() })
    assert.equal(toggle().props.disabled, true)
  } finally { if (renderer) await act(async () => renderer.unmount()) }
})
