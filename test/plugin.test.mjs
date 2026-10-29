import { CODEX_TEST_HOME } from '../harness-setup.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { readFile } from 'node:fs/promises'
import * as plugin from '../lib/index.js'
import { TYPERT } from '../lib/remote.js'

test('package and root plugin expose namespaced WorkBuddy and Codex components', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  assert.equal(pkg.name, 'dsh-provider')
  assert.equal(plugin.name, 'dsh-provider')
  const config = plugin.Config({ workbuddy: { mode: 'workbuddy', workbuddyRegion: 'intl' } })
  assert.equal(config.workbuddy.mode.get(), 'workbuddy')
  assert.equal(config.workbuddy.workbuddyRegion.get(), 'intl')
  assert.equal(config.workbuddy.contextWindow.get(), 'middle')
  assert.equal(config.codex.codexHome, '')
  assert.equal(config.codex.timeoutMs, 180000)
  assert.ok(pkg.exports['./components/codex'])
  assert.equal(TYPERT.package, 'dsh-provider')
  assert.equal(TYPERT.invocations[0].namespace, 'workbuddyProvider')
  assert.ok(TYPERT.invocations.some(invocation => invocation.namespace === 'codexProvider'))
})

test('root mounts and disposes both components with independent model routes', async () => {
  const ctx = new Context()
  const runtime = ctx.plugin(LlmRuntime)
  await runtime.await()
  const fiber = ctx.plugin(plugin, { workbuddy: {}, codex: { codexHome: CODEX_TEST_HOME } })
  await fiber.await()
  try {
    assert.deepEqual((await ctx.llm.listModels('workbuddy')).map(model => model.id), ['auto'])
    assert.ok(ctx.get('workbuddyProvider'))
    assert.ok(ctx.get('codexProvider'))
    assert.ok(ctx.llm.listProviders().some(provider => provider.id === 'codex'))
    assert.deepEqual(await ctx.llm.listModels('codex'), [])
    await fiber.dispose()
    assert.deepEqual(ctx.llm.listProviders(), [])
    assert.equal(ctx.get('workbuddyProvider'), undefined)
    assert.equal(ctx.get('codexProvider'), undefined)
  } finally { await ctx.fiber.dispose() }
})
