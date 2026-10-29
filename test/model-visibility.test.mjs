import '../harness-setup.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { fileURLToPath } from 'node:url'
import { REMOTE as codexRemote } from '../lib/components/codex/remote.js'
import { REMOTE as workbuddyRemote } from '../lib/components/workbuddy/remote.js'

test('each component persists hidden models independently while live updates retain its runtime and full directory', async t => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-model-visibility-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  await writeFile(join(home, 'models_cache.json'), JSON.stringify({ models: [
    { slug: 'shared-id', display_name: 'Codex Shared', context_window: 500000 },
    { slug: 'codex-only', display_name: 'Codex Only', context_window: 272000 },
  ] }))
  const server = createServer((_request, response) => response.end(JSON.stringify({ data: [
    { id: 'shared-id', name: 'WorkBuddy Shared', contextWindow: 1000000 },
    { id: 'workbuddy-only', name: 'WorkBuddy Only' },
  ] })))
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const entries = composeEntries([loadOverlayPatches('dsh', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))])
    .map(row => row.group ? row : { ...row, config: row.id === 'dsh-provider'
      ? { workbuddy: { baseURL: `http://127.0.0.1:${server.address().port}/v2`, hiddenModels: ['not-in-catalog'] } }
      : { codexHome: home } })
  const mount = async rows => {
    const ctx = new Context()
    ctx.provide('credentials', { resolve: async () => ({ value: 'test-key', source: 'file' }) })
    await ctx.plugin(LlmRuntime).await()
    await ctx.plugin(Loader, { baseUrl: new URL('../package.json', import.meta.url).href }).await()
    await ctx.loader.root.update(rows); await ctx.loader.await()
    return ctx
  }
  let ctx = await mount(entries)
  const ids = async provider => (await ctx.llm.listModels(provider)).map(model => model.id)
  try {
    assert.deepEqual(await ids('codex'), ['shared-id', 'codex-only'])
    assert.deepEqual(await ids('workbuddy'), ['auto', 'shared-id', 'workbuddy-only'])
    const codex = ctx.loader.resolve('dsh-provider-codex'), workbuddy = ctx.loader.resolve('dsh-provider')
    const codexFiber = codex.fiber, workbuddyFiber = workbuddy.fiber
    let changes = 0
    ctx.on('llm/adapters-updated', () => { changes++ })
    await codex.update({ config: { ...codex.options.config, hiddenModels: ['shared-id'] } }); await ctx.loader.await()
    assert.equal(codex.fiber, codexFiber)
    assert.deepEqual(await ids('codex'), ['codex-only'])
    assert.ok((await ids('workbuddy')).includes('shared-id'))
    assert.ok(changes > 0)
    assert.equal((await ctx.llm.resolveModelInfo('codex', 'shared-id')).context.contextWindow, 500000)
    assert.deepEqual((await ctx.get('codexProvider').models(false)).models.map(model => model.id), ['shared-id', 'codex-only'])
    await workbuddy.update({ config: { workbuddy: { ...workbuddy.options.config.workbuddy, hiddenModels: ['auto', 'shared-id', 'workbuddy-only'] } } })
    await ctx.loader.await()
    assert.equal(workbuddy.fiber, workbuddyFiber)
    assert.deepEqual(await ids('workbuddy'), [])
    assert.deepEqual((await ctx.get('workbuddyProvider').models(true)).models.map(model => model.id), ['auto', 'shared-id', 'workbuddy-only'])
    assert.deepEqual(await ids('workbuddy'), [])
    const saved = entries.map(row => ({ ...row, config: ctx.loader.resolve(row.id).options.config }))
    const file = join(home, 'preferences.json')
    await writeFile(file, JSON.stringify(saved))
    await ctx.fiber.dispose()
    ctx = await mount(JSON.parse(await readFile(file, 'utf8')))
    assert.deepEqual(await ids('workbuddy'), [])
    assert.deepEqual(await ids('codex'), ['codex-only'])
    const restored = ctx.loader.resolve('dsh-provider')
    await restored.update({ config: { workbuddy: { ...restored.options.config.workbuddy, hiddenModels: [] } } })
    await ctx.loader.await()
    assert.deepEqual(await ids('workbuddy'), ['auto', 'shared-id', 'workbuddy-only'])
  } finally { await ctx.fiber.dispose() }
})

test('both model-directory Remotes reject invalid refresh inputs and expose only safe model metadata', () => {
  for (const remote of [codexRemote, workbuddyRemote]) {
    const method = Object.values(remote.methods).find(method => method.method === 'models')
    assert.ok(method)
    assert.throws(() => method.input().create().parse({ refresh: 'true' }))
    const output = method.result.create().parse({ models: [{ id: 'test', name: 'Test', access_token: 'private' }], account_id: 'private' })
    assert.deepEqual(output, { models: [{ id: 'test', name: 'Test' }] })
  }
})
