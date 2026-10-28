import type { ModelConfig } from './config.js'

interface CatalogConnection {
  baseURL: string
  resolveApiKey(): Promise<string>
  fetch?: typeof fetch
}

type ObjectValue = Record<string, unknown>
const object = (value: unknown): ObjectValue => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {}
const positive = (value: unknown): number | undefined => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined

/** The official CLI uses /v3/config; custom OpenAI gateways use /models. */
export function catalogURL(baseURL: string): string {
  const url = new URL(baseURL)
  return ['copilot.tencent.com', 'www.codebuddy.ai'].includes(url.hostname) && url.pathname === '/v2'
    ? new URL('/v3/config', url).href : baseURL + '/models'
}

export function parseCatalog(value: unknown): ModelConfig[] {
  const envelope = object(value)
  if (envelope.code !== undefined && envelope.code !== 0) throw new Error('CodeBuddy catalog refused')
  const data = object(envelope.data)
  const entries = Array.isArray(envelope.data) ? envelope.data : data.models ?? envelope.models
  if (!Array.isArray(entries)) throw new Error('CodeBuddy catalog missing models')
  const agents = data.agents ?? object(data.agent).agents
  const cli = Array.isArray(agents) ? agents.map(object).find(agent => agent.name === 'cli') : undefined
  const allowed = Array.isArray(cli?.models) && cli.models.length ? new Set(cli.models) : undefined
  const models = new Map<string, ModelConfig>()
  for (const entry of entries) {
    const raw = object(entry)
    if (typeof raw.id !== 'string' || !raw.id.trim() || raw.id !== raw.id.trim()
      || raw.disabled === true || raw.supportsToolCall === false || (allowed && !allowed.has(raw.id))
      || (Array.isArray(raw.tags) && raw.tags.some(tag => ['text-to-image', 'image-to-image', 'text-to-video'].includes(String(tag))))) continue
    const contextWindow = positive(raw.contextWindow ?? raw.maxAllowedSize ?? raw.maxInputTokens)
    const maxTokens = positive(raw.maxTokens ?? raw.maxOutputTokens)
    models.set(raw.id, {
      id: raw.id,
      ...(typeof raw.name === 'string' && raw.name.trim() ? { name: raw.name } : {}),
      ...(contextWindow ? { contextWindow } : {}),
      ...(maxTokens ? { maxTokens: contextWindow ? Math.min(contextWindow, maxTokens) : maxTokens } : {}),
    })
  }
  if (!models.size) throw new Error('CodeBuddy catalog contains no chat models')
  return [...models.values()]
}

/** Cache the last successful catalog; a failed refresh never empties the selector. */
export class ModelCatalog {
  private remote: ModelConfig[] = []
  private nextRefresh = 0
  private pending?: Promise<void>
  private controller = new AbortController()
  private generation = 0
  private disposed = false

  constructor(
    private readonly manual: ModelConfig[],
    private readonly intervalMs: number,
    private readonly connection: CatalogConnection,
    private readonly changed: () => void = () => {},
  ) {}

  models(): ModelConfig[] {
    const models = new Map(this.remote.map(model => [model.id, model]))
    for (const model of this.manual) {
      const overrides = Object.fromEntries(Object.entries(model).filter(([, value]) => value !== undefined))
      models.set(model.id, { ...models.get(model.id), ...overrides } as ModelConfig)
    }
    // Keep explicit choices, including Auto, ahead of the discovered models.
    return [...this.manual.map(model => models.get(model.id)!), ...[...models.values()].filter(model => !this.manual.some(item => item.id === model.id))]
  }

  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (this.pending) return this.pending
    if (Date.now() < this.nextRefresh) return Promise.resolve()
    const generation = this.generation
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(10000)])
    const task = (async () => {
      try {
        const apiKey = await this.connection.resolveApiKey()
        signal.throwIfAborted()
        const response = await (this.connection.fetch ?? fetch)(catalogURL(this.connection.baseURL), {
          headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey,
            'User-Agent': 'CLI/2.177.0 CodeBuddy/2.177.0', 'X-Product': 'SaaS' },
          signal, redirect: 'error',
        })
        if (!response.ok) { await response.body?.cancel(); throw new Error('CodeBuddy catalog unavailable') }
        const models = parseCatalog(await response.json())
        if (this.disposed || generation !== this.generation) return
        this.nextRefresh = Date.now() + this.intervalMs
        if (JSON.stringify(models) !== JSON.stringify(this.remote)) {
          this.remote = models
          this.changed()
        }
      } catch {
        // Never surface transport bodies/headers, which can echo the API key.
        if (generation === this.generation) this.nextRefresh = Date.now() + Math.min(this.intervalMs, 60000)
      }
    })()
    this.pending = task
    void task.finally(() => { if (this.pending === task) this.pending = undefined })
    return task
  }

  credentialsChanged(): void {
    if (this.disposed) return
    this.generation++
    this.controller.abort()
    this.controller = new AbortController()
    this.pending = undefined
    this.nextRefresh = 0
    const hadModels = this.remote.length > 0
    this.remote = []
    if (hadModels) this.changed()
    void this.refresh()
  }

  dispose(): void {
    this.disposed = true
    this.controller.abort()
  }
}
