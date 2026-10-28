import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { readFile } from 'node:fs/promises'
import * as plugin from '../lib/index.js'
import { TYPERT } from '../lib/remote.js'

test('package and root plugin expose dsh-provider with namespaced WorkBuddy configuration', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  assert.equal(pkg.name, 'dsh-provider')
  assert.equal(plugin.name, 'dsh-provider')
  const config = plugin.Config({ workbuddy: { mode: 'workbuddy', workbuddyRegion: 'intl' } })
  assert.equal(config.workbuddy.mode.get(), 'workbuddy')
  assert.equal(config.workbuddy.workbuddyRegion.get(), 'intl')
  assert.equal(config.workbuddy.contextWindow.get(), 'max')
  assert.equal(TYPERT.package, 'dsh-provider')
  assert.equal(TYPERT.invocations[0].namespace, 'workbuddyProvider')
})

test('root mounts and disposes the WorkBuddy component with its own model route', async () => {
  const ctx = new Context()
  const runtime = ctx.plugin(LlmRuntime)
  await runtime.await()
  const fiber = ctx.plugin(plugin, { workbuddy: {} })
  await fiber.await()
  try {
    assert.deepEqual((await ctx.llm.listModels('workbuddy')).map(model => model.id), ['auto'])
    assert.ok(ctx.get('workbuddyProvider'))
    await fiber.dispose()
    assert.deepEqual(ctx.llm.listProviders(), [])
    assert.equal(ctx.get('workbuddyProvider'), undefined)
  } finally { await ctx.fiber.dispose() }
})
