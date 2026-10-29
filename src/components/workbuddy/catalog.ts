import { resolveContextWindow } from './config.js'
import type { ContextWindowMode, ModelConfig } from './config.js'
interface CatalogConnection {
  baseURL: string
  resolveApiKey?(): Promise<string>
  authenticate?(signal?: AbortSignal): Promise<{ apiKey: string; headers: Record<string, string> }>
  catalogURL?: string
  fetch?: typeof fetch
}

type ObjectValue = Record<string, unknown>
const object = (value: unknown): ObjectValue => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {}
const positive = (value: unknown): number | undefined => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : []
/**
 * Credit multiplier one catalog entry advertises. WorkBuddy reports it as a
 * short string such as `x0.69`; a bare number is normalized to the same form so
 * every model carries one consistent spelling.
 */
const creditMultiplier = (value: unknown): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return 'x' + value
  if (typeof value !== 'string') return undefined
  const text = value.trim().toLowerCase()
  return /^x\d+(?:\.\d+)?$/.test(text) ? text : undefined
}
/** Selectable context lengths a contextWindow object advertises, in the order given. */
const supportedLengths = (value: unknown): number[] => {
  const item = object(value)
  return Array.isArray(item.supportedLengths)
    ? item.supportedLengths.map(positive).filter((length): length is number => length !== undefined) : []
}
/** Highest capacity a contextWindow object advertises ({ defaultLength, supportedLengths }). */
const supportedCapacity = (value: unknown): number | undefined => {
  const lengths = supportedLengths(value)
  return lengths.length ? Math.max(...lengths) : positive(object(value).defaultLength)
}

/**
 * Thinking levels one catalog entry advertises. WorkBuddy exposes either a
 * `supportedEfforts` ladder (low→max) or a single legacy `effort`, plus an
 * optional `canDisableThinking` that adds the `none` level. Absent means the
 * model declares no thinking control, so the caller offers none.
 */
function reasoningOf(raw: ObjectValue): Pick<ModelConfig, 'reasoningEfforts' | 'defaultReasoningEffort' | 'canDisableThinking'> {
  if (raw.supportsReasoning === false) return {}
  const reasoning = object(raw.reasoning)
  const ladder = strings(reasoning.supportedEfforts)
  const single = typeof reasoning.effort === 'string' && reasoning.effort.trim() ? reasoning.effort.trim() : undefined
  const efforts = ladder.length ? ladder : single ? [single] : []
  if (!efforts.length) return {}
  const canDisable = reasoning.canDisableThinking === true || raw.canDisableThinking === true
  const levels = canDisable ? ['none', ...efforts] : efforts
  const configuredDefault = typeof reasoning.defaultEffort === 'string' && reasoning.defaultEffort.trim()
    ? reasoning.defaultEffort.trim() : single
  const defaultEffort = configuredDefault && levels.includes(configuredDefault) ? configuredDefault
    : levels.includes('high') ? 'high' : levels[levels.length - 1]
  return { reasoningEfforts: levels, ...(defaultEffort ? { defaultReasoningEffort: defaultEffort } : {}),
    ...(canDisable ? { canDisableThinking: true } : {}) }
}

/** Both official regions discover their model catalog at /v3/config. */
export function catalogURL(baseURL: string): string {
  return new URL('/v3/config', baseURL).href
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
    // The catalog may announce capacity as a number OR as a { defaultLength, supportedLengths }
    // object. Read each form explicitly: testing each candidate through positive() stops an
    // object form from shadowing the numeric maxAllowedSize/maxInputTokens fields.
    const capacity = positive(raw.contextWindow) ?? positive(raw.maxAllowedSize) ?? positive(raw.maxInputTokens)
      ?? supportedCapacity(raw.contextWindow)
    // The disclosed selectable lengths become the light/middle/max tiers; a model that only
    // announces one capacity still gets a single-element ladder so every tier resolves.
    const disclosed = supportedLengths(raw.contextWindow)
    const contextLengths = disclosed.length ? [...new Set(disclosed)].sort((a, b) => a - b)
      : capacity ? [capacity] : []
    const contextWindow = contextLengths.length ? contextLengths[contextLengths.length - 1] : capacity
    const maxTokens = positive(raw.maxTokens ?? raw.maxOutputTokens)
    const credits = creditMultiplier(raw.credits)
    models.set(raw.id, {
      id: raw.id,
      ...(typeof raw.name === 'string' && raw.name.trim() ? { name: raw.name } : {}),
      ...(contextWindow ? { contextWindow } : {}),
      ...(contextLengths.length ? { contextLengths } : {}),
      ...(maxTokens ? { maxTokens: contextWindow ? Math.min(contextWindow, maxTokens) : maxTokens } : {}),
      ...(typeof raw.supportsImages === 'boolean' ? { supportsImages: raw.supportsImages } : {}),
      ...(credits ? { credits } : {}),
      ...reasoningOf(raw),
    })
  }
  if (!models.size) throw new Error('CodeBuddy catalog contains no chat models')
  return [...models.values()]
}

/** Cache the last successful catalog; a failed refresh never empties the selector. */
export class ModelCatalog {
  issue?: string
  private remote: ModelConfig[] = []
  private pending?: Promise<void>
  private controller = new AbortController()
  private generation = 0
  private disposed = false

  constructor(
    private readonly baseline: ModelConfig[],
    private readonly connection: CatalogConnection,
    private readonly changed: () => void = () => {},
    /** Which context window the adapter should advertise (settings choice). */
    private readonly contextPolicy: () => ContextWindowMode = () => 'middle',
  ) {}

  /**
   * Models as the adapter routes them. The settings choice is a light/middle/max
   * tier that maps to each model's own disclosed lengths, so a request never
   * exceeds what that model actually accepts.
   */
  models(): ModelConfig[] {
    const models = new Map(this.remote.map(model => [model.id, model]))
    for (const model of this.baseline) {
      const overrides = Object.fromEntries(Object.entries(model).filter(([, value]) => value !== undefined))
      models.set(model.id, { ...models.get(model.id), ...overrides } as ModelConfig)
    }
    const policy = this.contextPolicy()
    for (const [id, model] of models) {
      models.set(id, { ...model, contextWindow: resolveContextWindow(policy, model) })
    }
    // Keep the built-in baseline entry (Auto) ahead of the discovered models.
    return [...this.baseline.map(model => models.get(model.id)!), ...[...models.values()].filter(model => !this.baseline.some(item => item.id === model.id))]
  }

  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (this.pending) return this.pending
    const generation = this.generation
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(10000)])
    const task = (async () => {
      try {
        const auth = this.connection.authenticate ? await this.connection.authenticate(signal) : undefined
        const apiKey = auth?.apiKey ?? await this.connection.resolveApiKey!()
        signal.throwIfAborted()
        const response = await (this.connection.fetch ?? fetch)(this.connection.catalogURL ?? catalogURL(this.connection.baseURL), {
          headers: { Accept: 'application/json', ...(auth?.headers ?? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey,
            'User-Agent': 'CLI/2.177.0 CodeBuddy/2.177.0', 'X-Product': 'SaaS' }) },
          signal, redirect: 'error',
        })
        if (!response.ok) { await response.body?.cancel(); throw new Error('CodeBuddy catalog unavailable') }
        const models = parseCatalog(await response.json())
        if (this.disposed || generation !== this.generation) return
        this.issue = undefined
        if (JSON.stringify(models) !== JSON.stringify(this.remote)) {
          this.remote = models
          this.changed()
        }
      } catch {
        // Never surface transport bodies/headers, which can echo the API key.
        if (!this.disposed && generation === this.generation) this.issue = this.remote.length
          ? '模型目录更新失败，正在显示已有模型。' : '暂时未获取到模型目录，正在显示默认模型。'
      }
    })()
    this.pending = task
    void task.finally(() => { if (this.pending === task) this.pending = undefined })
    return task
  }

  /** Wait for startup/key-save discovery; opening the selector performs no I/O. */
  async ready(): Promise<void> {
    while (this.pending && !this.disposed) await this.pending
  }

  credentialsChanged(): void {
    if (this.disposed) return
    this.generation++
    this.controller.abort()
    this.controller = new AbortController()
    this.pending = undefined
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
