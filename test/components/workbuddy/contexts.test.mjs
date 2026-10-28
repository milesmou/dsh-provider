import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ModelCatalog } from '../../../lib/components/workbuddy/catalog.js'
import { ContextWindowStore, formatContextWindow, normalizeContextWindow } from '../../../lib/components/workbuddy/contexts.js'
import { WorkBuddyController } from '../../../lib/components/workbuddy/controller.js'

test('context windows format and normalize predictably', () => {
  assert.equal(formatContextWindow(200 * 1024), '200K')
  assert.equal(formatContextWindow(1024 * 1024), '1M')
  assert.equal(formatContextWindow(512000), '500K')
  assert.equal(formatContextWindow(500001), '500001')
  assert.equal(formatContextWindow(undefined), '未知')
  assert.equal(normalizeContextWindow(204800), 204800)
  assert.equal(normalizeContextWindow(0), undefined)
  assert.equal(normalizeContextWindow(-1), undefined)
  assert.equal(normalizeContextWindow(1.5), undefined)
  assert.equal(normalizeContextWindow('204800'), undefined)
})

test('the context store persists per-model windows across reloads', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-context-store-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'nested', 'contexts.json')
  const store = new ContextWindowStore(file)
  store.set('m1', 200 * 1024)
  store.set('m2', 1024 * 1024)
  await store.persist()
  const reloaded = new ContextWindowStore(file)
  assert.equal(reloaded.get('m1'), 200 * 1024)
  assert.equal(reloaded.get('m2'), 1024 * 1024)
  assert.equal(reloaded.get('m3'), undefined)
  // Clearing one model is persisted too.
  reloaded.set('m2', undefined)
  await reloaded.persist()
  assert.equal(new ContextWindowStore(file).get('m2'), undefined)
})

test('the catalog advertises overrides while baseModels keeps the discovered capacity', () => {
  let overrides = {}
  const catalog = new ModelCatalog(
    [{ id: 'm1', name: 'Model One', contextWindow: 200 * 1024 }],
    { baseURL: 'https://example.invalid/v2' },
    () => {},
    () => overrides,
  )
  assert.equal(catalog.baseModels()[0].contextWindow, 200 * 1024)
  assert.equal(catalog.models()[0].contextWindow, 200 * 1024)
  overrides = { m1: 1024 * 1024 }
  assert.equal(catalog.baseModels()[0].contextWindow, 200 * 1024)
  assert.equal(catalog.models()[0].contextWindow, 1024 * 1024)
})

test('the controller lists models with overrides and saves a chosen window', async () => {
  const proto = WorkBuddyController.prototype
  const store = new ContextWindowStore()
  let emitted = 0
  const fake = {
    options: {
      enabled: () => true,
      ledger: { of: () => 0 },
      models: () => [{ id: 'm1', name: 'Model One', contextWindow: 200 * 1024 }],
      contexts: store,
      session: () => ({ accountCredits: async () => undefined }),
    },
    ctx: { emit: () => { emitted++ } },
    balances: new Map(),
  }
  const listed = await proto.contexts.call(fake)
  assert.deepEqual(listed, { models: [{ id: 'm1', name: 'Model One', contextWindow: 200 * 1024 }], overrides: {} })
  assert.deepEqual(await proto.setContext.call(fake, 'm1', 1024 * 1024), { ok: true })
  assert.equal(store.get('m1'), 1024 * 1024)
  assert.equal(emitted, 1)
  assert.deepEqual((await proto.contexts.call(fake)).overrides, { m1: 1024 * 1024 })
  // Zero clears the override so the model default applies again.
  await proto.setContext.call(fake, 'm1', 0)
  assert.equal(store.get('m1'), undefined)
})
