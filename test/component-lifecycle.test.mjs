import { CODEX_TEST_HOME } from '../harness-setup.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { SettingsForms } from '@deepseek-ai/dsh-settings'
import { SettingsController } from '@deepseek-ai/dsh-api-settings-controller'
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mountClient, settleClient } from '../client-harness.mjs'

const cardsSlot = 'dsh-provider.settings.cards'
const headerSlot = 'conversation.session.header.utilities'
const labelSlot = 'conversation.input.model.label'
const turnSlot = 'conversation.chat.turnTail'
const ids = (ctx, slot) => ctx.slots.entries(slot).map(entry => entry.options.id).sort()

test('real Loader and Settings lifecycle hides disabled component UI and restores it independently', async () => {
  const host = new Context()
  let client
  try {
    new TypertRegistry(host)
    await host.plugin(LlmRuntime).await()
    await host.plugin(Loader, { baseUrl: new URL('../package.json', import.meta.url).href }).await()
    // Only the profile storage seam is injected; Settings reads real Loader
    // fibers and emits its own availability notifications on policy disposal.
    host.provide('profileContext', { home: process.env.DSH_HOME })
    host.provide('configEditor', { configuration: () => [...host.loader.entries()].map(entry => ({
      entry, inherited: entry.options.config ?? {}, override: {},
    })) })
    await host.plugin(SettingsForms).await()
    await host.plugin(SettingsController).await()
    const entries = composeEntries([loadOverlayPatches('dsh', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))])
      .map(entry => entry.group ? entry : { ...entry, disabled: entry.id === 'dsh-provider-codex', config: entry.id === 'dsh-provider'
        ? { workbuddy: { hiddenModels: ['saved-workbuddy-model'] } }
        : { codexHome: CODEX_TEST_HOME, hiddenModels: ['saved-codex-model'] } })
    await host.loader.root.update(entries)
    await host.loader.await()
    host.on('settings/document-updated', (ns, revision) => { void client?.emit('settings/document-updated', ns, revision) })
    const requests = []
    client = await mountClient(async endpoint => {
      requests.push(endpoint)
      assert.equal(endpoint, 'settings/describe')
      return { ok: true, value: host.settingsController.describe() }
    })
    const { ctx } = client
    const builtin = () => null
    ctx.slots.register({ name: labelSlot }, builtin)
    const label = route => {
      const entry = ctx.slots.entries(labelSlot).find(entry => entry.component !== builtin)
      return renderToStaticMarkup(createElement(entry.component, {
        provider: { id: route }, model: { id: 'saved-model', name: 'Saved model', description: 'x0.11' },
      }))
    }
    assert.deepEqual(ids(ctx, cardsSlot), ['workbuddy'], 'a disabled-at-startup Codex never renders its error card')
    assert.deepEqual(ids(ctx, headerSlot), ['workbuddy-credits'])
    assert.deepEqual(ids(ctx, turnSlot), ['workbuddy-turn-credits'])
    assert.doesNotMatch(label('codex'), /<svg/)
    assert.match(label('workbuddy'), /<svg/)
    const workbuddyCard = ctx.slots.entries(cardsSlot)[0]
    const workbuddy = host.loader.resolve('dsh-provider')
    const codex = host.loader.resolve('dsh-provider-codex')
    const toggle = async (entry, disabled) => {
      await entry.update({ disabled })
      await host.loader.await()
      await settleClient()
    }
    await toggle(codex, false)
    assert.deepEqual(ids(ctx, cardsSlot), ['codex', 'workbuddy'])
    assert.equal(ctx.slots.entries(cardsSlot).find(entry => entry.options.id === 'workbuddy'), workbuddyCard)
    assert.match(label('codex'), /<svg/)
    const codexCard = ctx.slots.entries(cardsSlot).find(entry => entry.options.id === 'codex')
    await toggle(workbuddy, true)
    assert.deepEqual(ids(ctx, cardsSlot), ['codex'])
    assert.equal(ctx.slots.entries(cardsSlot)[0], codexCard)
    assert.deepEqual(ids(ctx, headerSlot), ['codex-quota'])
    assert.deepEqual(ids(ctx, turnSlot), [])
    assert.doesNotMatch(label('workbuddy'), /<svg|积分倍率/)
    assert.match(label('codex'), /<svg/)
    await toggle(codex, true)
    assert.deepEqual(ids(ctx, cardsSlot), [])
    assert.deepEqual(ids(ctx, headerSlot), [])
    assert.deepEqual(ctx.slots.entries(labelSlot).map(entry => entry.component), [builtin])
    assert.ok(ctx.typert.remotes.get('codexProvider/command'), 'the shared Remote stays mounted even with no active Host')
    for (let cycle = 0; cycle < 3; cycle++) {
      await toggle(workbuddy, false)
      await toggle(codex, false)
      assert.deepEqual(ids(ctx, cardsSlot), ['codex', 'workbuddy'])
      assert.deepEqual(ids(ctx, headerSlot), ['codex-quota', 'workbuddy-credits'])
      assert.deepEqual(ids(ctx, turnSlot), ['workbuddy-turn-credits'])
      assert.equal(ctx.slots.entries(labelSlot).length, 2)
      await toggle(workbuddy, true)
      await toggle(codex, true)
    }
    assert.deepEqual(workbuddy.options.config.workbuddy.hiddenModels, ['saved-workbuddy-model'])
    assert.deepEqual(codex.options.config.hiddenModels, ['saved-codex-model'])
    assert.ok(requests.every(endpoint => endpoint === 'settings/describe'), 'disabled UI makes no provider requests or configuration writes')
  } finally {
    await client?.ctx.fiber.dispose()
    await host.fiber.dispose()
  }
})

test('availability reads coalesce changes, ignore obsolete replies and stop after client disposal', async () => {
  let rows = [{ ns: 'dsh-provider' }, { ns: 'dsh-provider-codex' }]
  let read = async () => ({ ok: true, value: { namespaces: rows } })
  let reads = 0
  const { ctx, fiber, emit } = await mountClient(async endpoint => {
    assert.equal(endpoint, 'settings/describe')
    reads++
    return read()
  })
  try {
    assert.deepEqual(ids(ctx, cardsSlot), ['codex', 'workbuddy'])
    const originalReads = reads
    await emit('settings/document-updated', 'other-component', 1)
    assert.equal(reads, originalReads)
    let finish
    read = () => new Promise(resolve => { finish = resolve })
    await emit('settings/document-updated', 'dsh-provider-codex', 1)
    assert.equal(reads, originalReads + 1)
    await emit('settings/document-updated', 'dsh-provider', 2)
    await emit('settings/document-updated', 'dsh-provider-codex', 2)
    assert.equal(reads, originalReads + 1, 'concurrent changes share one in-flight read')
    rows = [{ ns: 'dsh-provider' }]
    read = async () => ({ ok: true, value: { namespaces: rows } })
    finish({ ok: true, value: { namespaces: [{ ns: 'dsh-provider-codex' }] } })
    await settleClient()
    assert.equal(reads, originalReads + 2)
    assert.deepEqual(ids(ctx, cardsSlot), ['workbuddy'], 'a late snapshot cannot replace the newer component state')
    const original = ctx.slots.entries(cardsSlot)[0]
    read = async () => { throw new Error('private-host-detail') }
    await emit('settings/document-updated', 'dsh-provider', 3)
    assert.equal(ctx.slots.entries(cardsSlot)[0], original, 'a network failure preserves the last confirmed state')
    rows = []
    read = async () => ({ ok: true, value: { namespaces: rows } })
    await ctx.parallel('connection/reset')
    await settleClient()
    assert.deepEqual(ids(ctx, cardsSlot), [], 'reconnecting rereads active components')
    read = () => new Promise(resolve => { finish = resolve })
    await emit('settings/document-updated', 'dsh-provider-codex', 4)
    await fiber.dispose()
    finish({ ok: true, value: { namespaces: [{ ns: 'dsh-provider-codex' }] } })
    await settleClient()
    assert.deepEqual(ids(ctx, cardsSlot), [])
    assert.deepEqual(ids(ctx, headerSlot), [])
    assert.deepEqual(ctx.slots.entries(labelSlot), [])
    const stoppedReads = reads
    await emit('settings/document-updated', 'dsh-provider-codex', 5)
    await ctx.parallel('connection/reset')
    assert.equal(reads, stoppedReads, 'disposal detaches Remote and connection listeners')
  } finally { await ctx.fiber.dispose() }
})
