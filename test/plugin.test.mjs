import { CODEX_TEST_HOME } from '../harness-setup.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { ClientModuleRegistry } from '@deepseek-ai/dsh-client-modules'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import * as plugin from '../lib/index.js'
import { TYPERT } from '../lib/remote.js'

test('legacy root keeps the original CodeBuddy settings and component exports are separate', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  assert.equal(pkg.name, 'dsh-provider')
  assert.equal(plugin.name, 'dsh-provider')
  const config = plugin.Config({ workbuddy: { mode: 'workbuddy', workbuddyRegion: 'intl' } })
  assert.equal(config.workbuddy.mode.get(), 'workbuddy')
  assert.equal(config.workbuddy.workbuddyRegion.get(), 'intl')
  assert.equal(config.workbuddy.contextWindow.get(), 'middle')
  assert.equal(config.codex, undefined)
  assert.ok(pkg.exports['./components/codex'])
  assert.equal(TYPERT.package, 'dsh-provider')
  assert.equal(TYPERT.invocations[0].namespace, 'workbuddyProvider')
  assert.ok(TYPERT.invocations.some(invocation => invocation.namespace === 'codexProvider'))
})

test('legacy root mounts CodeBuddy without implicitly mounting Codex', async () => {
  const ctx = new Context()
  const runtime = ctx.plugin(LlmRuntime)
  await runtime.await()
  const fiber = ctx.plugin(plugin, { workbuddy: {} })
  await fiber.await()
  try {
    assert.deepEqual((await ctx.llm.listModels('workbuddy')).map(model => model.id), ['auto'])
    assert.ok(ctx.get('workbuddyProvider'))
    assert.equal(ctx.get('codexProvider'), undefined)
    assert.deepEqual(ctx.llm.listProviders().map(provider => provider.id), ['workbuddy'])
    await fiber.dispose()
    assert.deepEqual(ctx.llm.listProviders(), [])
    assert.equal(ctx.get('workbuddyProvider'), undefined)
    assert.equal(ctx.get('codexProvider'), undefined)
  } finally { await ctx.fiber.dispose() }
})

const bundleEntries = () => composeEntries([loadOverlayPatches('dsh', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))])

test('the bundle exposes two named components through the same metadata resolver used by DSH', () => {
  const entries = bundleEntries()
  const components = entries.filter(entry => !entry.group)
  assert.deepEqual(components.map(entry => entry.name), ['dsh-provider/components/workbuddy', 'dsh-provider/components/codex'])
  const script = `
    import { readPluginMeta } from '@deepseek-ai/dsh-app-boot';
    const entries = ${JSON.stringify(components)};
    console.log(JSON.stringify(entries.map(entry => readPluginMeta(entry.name, ${JSON.stringify(new URL('../package.json', import.meta.url).href)}))));
  `
  const result = spawnSync(process.execPath, ['--expose-internals', '--input-type=module', '-e', script], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', windowsHide: true,
  })
  assert.equal(result.status, 0, result.stderr)
  const metadata = JSON.parse(result.stdout)
  assert.deepEqual(metadata.map(meta => meta.title.zh), ['CodeBuddy', 'Codex'])
  assert.ok(metadata.every(meta => meta.error === undefined))
})

test('real Loader entries let CodeBuddy and Codex be disabled independently', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin(LlmRuntime).await()
    await ctx.plugin(Loader, { baseUrl: new URL('../package.json', import.meta.url).href }).await()
    const entries = bundleEntries().map(entry => entry.group ? entry : ({ ...entry, config: entry.id === 'dsh-provider'
      ? { workbuddy: { mode: 'workbuddy', workbuddyRegion: 'intl', contextWindow: 'max' } }
      : { codexHome: CODEX_TEST_HOME } }))
    await ctx.loader.root.update(entries)
    await ctx.loader.await()
    assert.equal([...ctx.loader.entries()].filter(entry => !entry.options.group).length, 2)
    assert.deepEqual(ctx.llm.listProviders().map(provider => provider.id).sort(), ['codex', 'workbuddy'])
    const workbuddy = ctx.loader.resolve('dsh-provider')
    const codex = ctx.loader.resolve('dsh-provider-codex')
    const original = workbuddy.fiber
    await codex.update({ disabled: true })
    await ctx.loader.await()
    assert.deepEqual(ctx.llm.listProviders().map(provider => provider.id), ['workbuddy'])
    assert.equal(workbuddy.fiber, original)
    assert.equal(ctx.get('codexProvider'), undefined)
    await codex.update({ disabled: false })
    await ctx.loader.await()
    assert.ok(ctx.get('codexProvider'))
    await workbuddy.update({ disabled: true })
    await ctx.loader.await()
    assert.deepEqual(ctx.llm.listProviders().map(provider => provider.id), ['codex'])
    assert.equal(ctx.get('workbuddyProvider'), undefined)
  } finally { await ctx.fiber.dispose() }
})

test('the real browser registry discovers the shared settings bundle while providers remain independent', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin(LlmRuntime).await()
    await ctx.plugin(Loader, { baseUrl: new URL('../package.json', import.meta.url).href }).await()
    const entries = bundleEntries().map(entry => entry.group ? entry : ({ ...entry, config: entry.id === 'dsh-provider'
      ? { workbuddy: {} } : { codexHome: CODEX_TEST_HOME } }))
    await ctx.loader.root.update(entries)
    await ctx.loader.await()
    await ctx.plugin(ClientModuleRegistry).await()
    const graph = ctx.clientModules.graph()
    assert.deepEqual(graph.entries.map(entry => entry.id), ['dsh-provider'])
    assert.equal(ctx.clientModules.clientPath('dsh-provider'), fileURLToPath(new URL('../lib/client.js', import.meta.url)))
    const response = await ctx.clientModules.fetchBundle(new Request(new URL(graph.batches[0].url, 'http://localhost/')))
    assert.equal(response.status, 200)
    const source = await response.text()
    assert.match(source, /workbuddy-component-settings/)
    assert.match(source, /codex-component-settings/)
    await ctx.loader.resolve('dsh-provider-codex').update({ disabled: true })
    await ctx.loader.await()
    assert.deepEqual(ctx.clientModules.graph().entries.map(entry => entry.id), ['dsh-provider'])
    assert.deepEqual(ctx.llm.listProviders().map(provider => provider.id), ['workbuddy'])
    ctx.loader.remove('dsh-provider-client')
    await ctx.loader.await()
    assert.deepEqual(ctx.clientModules.graph().entries, [])
  } finally { await ctx.fiber.dispose() }
})
