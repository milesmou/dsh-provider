import type { Context, Fiber } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import * as workbuddy from '../components/workbuddy/client/index.js'
import * as codex from '../components/codex/client/index.js'
import * as modelLabel from './model-label.js'

export const name = 'dsh-provider-component-lifecycle'
export const inject = ['remote.settings']

declare module '@deepseek-ai/cordis' {
  interface Events {
    'connection/reset'(): void
  }
}

const components = [
  { namespace: 'dsh-provider', route: 'workbuddy', plugin: workbuddy },
  { namespace: 'dsh-provider-codex', route: 'codex', plugin: codex },
]

/** Remote namespaces describe callable methods, not whether their Host is running. */
export function apply(ctx: Context): Promise<void> {
  const mounted = new Map<string, Fiber>()
  let labels: Fiber | undefined
  let labelRoutes = ''
  let live = true
  let dirty = false
  let pending: Promise<void> | undefined
  ctx.effect(() => () => { live = false })

  async function reconcile(namespaces: Set<string>): Promise<void> {
    for (const component of components) {
      if (!live) return
      const current = mounted.get(component.route)
      if (!namespaces.has(component.namespace)) {
        mounted.delete(component.route)
        await current?.dispose()
      } else if (!current) {
        const fiber = ctx.plugin(component.plugin)
        mounted.set(component.route, fiber)
        await fiber.await()
      }
    }
    if (!live) return
    const routes = [...mounted.keys()]
    if (routes.join(',') === labelRoutes) return
    await labels?.dispose()
    labels = undefined
    if (!live) return
    labelRoutes = routes.join(',')
    if (routes.length) {
      labels = ctx.plugin(modelLabel, { providers: routes })
      await labels.await()
    }
  }

  async function synchronize(): Promise<void> {
    while (live && dirty) {
      dirty = false
      // Settings only describes active Loader instances. It also emits a change
      // when an instance disappears, including edits outside Plugin Manager.
      let result
      try { result = await ctx.remote.settings.describe() }
      catch { continue }
      // A newer notification makes this response obsolete. Keep the last known
      // state on transport errors and reread when the connection returns.
      if (!live || dirty || !result.ok) continue
      await reconcile(new Set(result.value.namespaces.map(value => value.ns)))
    }
  }

  function refresh(): Promise<void> {
    if (!live) return Promise.resolve()
    dirty = true
    return pending ??= synchronize().finally(() => { pending = undefined })
  }

  ctx.remote.$on('settings/document-updated', ns => {
    if (components.some(component => component.namespace === ns)) return refresh()
  })
  ctx.on('connection/reset', refresh)
  return refresh()
}
