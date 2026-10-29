import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { Context } from '@deepseek-ai/cordis'
import * as gateway from '@deepseek-ai/dsh-api-gateway/client'
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
import SETTINGS from '@deepseek-ai/dsh-api-settings-controller/remote'

async function loadBrowserBundle(file) {
  let result
  runInNewContext(await readFile(file, 'utf8'), {
    setTimeout, clearTimeout,
    window: { __ModuleLoader__: { load: ({ factory }) => { result = factory(createRequire(import.meta.url)) } } },
  })
  return result
}

export const provider = await loadBrowserBundle(new URL('./lib/client.js', import.meta.url))
const renderer = await loadBrowserBundle(new URL('./node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js', import.meta.url))
export const settleClient = async () => { await new Promise(setImmediate); await new Promise(setImmediate) }

/** Real Cordis, Remote and slots; only the Connection transport is injected. */
export async function mountClient(call) {
  const ctx = new Context()
  const lifetime = new AbortController()
  const queue = []
  let wake
  const connection = {
    interactions: 'answer',
    generation: { getSnapshot: () => undefined },
    registerGenerationSource: source => {
      void source(lifetime.signal, () => {})
      return () => lifetime.abort()
    },
    start: () => ({ stop: () => lifetime.abort() }),
    rpc: {
      call: (_path, endpoint, payload, signal) => call(endpoint, payload.args, signal),
      open: async function* (_path, endpoint, _payload, signal) {
        if (endpoint !== '$events') throw new Error(`Unexpected test stream: ${endpoint}`)
        const resume = () => { wake?.(); wake = undefined }
        signal.addEventListener('abort', resume)
        try {
          yield { type: 'ready', clientId: 'test-client', host: { home: 'test-home' } }
          while (!signal.aborted) {
            if (!queue.length) await new Promise(resolve => { wake = resolve })
            if (!signal.aborted && queue.length) yield queue.shift()
          }
        } finally { signal.removeEventListener('abort', resume) }
      },
    },
  }
  try {
    new TypertRegistry(ctx)
    ctx.provide('connection', connection)
    ctx.provide('modelDirectories', { directoryFor: () => undefined })
    new renderer.SlotRegistry(ctx)
    ctx.slots.register({ name: 'root', children: {
      'settings.section': { kind: 'list', scope: 'root' },
      'settings.models.footer': { kind: 'list', scope: 'root' },
      'conversation.input.model.label': { kind: 'single', scope: 'session' },
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
      'conversation.chat.turnTail': { kind: 'list', scope: 'session' },
    } }, () => null)
    await ctx.plugin(gateway).await()
    await ctx.remote.$mount(SETTINGS)
    const fiber = ctx.plugin(provider)
    await fiber.await()
    await settleClient()
    return { ctx, fiber, emit: async (event, ...args) => {
      queue.push({ type: 'emit', event, args })
      wake?.(); wake = undefined
      await settleClient()
    } }
  } catch (error) { await ctx.fiber.dispose(); throw error }
}
