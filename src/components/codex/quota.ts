import { createHash } from 'node:crypto'
import { object } from './session.js'
import type { CodexAuth, CodexSession } from './session.js'
import type { QuotaView } from './remote.js'

export const QUOTA_URL = 'https://chatgpt.com/backend-api/wham/usage'
const unavailable = (issue: string): QuotaView => ({ available: false, windows: [], issue })
const identityOf = (auth: CodexAuth): string => createHash('sha256')
  .update(auth.headers['ChatGPT-Account-Id'] ?? '').update('\0').update(auth.apiKey).digest('hex')

/** Only quota fields leave the Host; account identifiers and credentials are discarded. */
export function parseQuota(value: unknown, now = Date.now()): QuotaView {
  const raw = object(value)
  const limits = object(raw.rate_limit)
  const windows: QuotaView['windows'] = []
  for (const kind of ['primary', 'secondary'] as const) {
    const window = object(limits[`${kind}_window`])
    const used = window.used_percent
    if (typeof used !== 'number' || !Number.isFinite(used)) continue
    const duration = window.limit_window_seconds
    const reset = window.reset_at
    const after = window.reset_after_seconds
    const resetsAt = typeof reset === 'number' && Number.isFinite(reset) && reset >= 0 ? reset
      : typeof after === 'number' && Number.isFinite(after) && after >= 0 ? Math.floor(now / 1000) + after : undefined
    windows.push({ kind, usedPercent: Math.max(0, Math.min(100, used)),
      ...(typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? { windowDurationMins: duration / 60 } : {}),
      ...(resetsAt === undefined ? {} : { resetsAt }),
    })
  }
  if (!windows.length) throw new Error('Codex quota windows missing')
  const plan = typeof raw.plan_type === 'string' && /^[a-z_\d-]{1,40}$/i.test(raw.plan_type) ? raw.plan_type : undefined
  return { available: true, windows, updatedAt: now, ...(plan ? { plan } : {}) }
}

interface Connection {
  fetch?: typeof fetch
  url?: string
  now?: () => number
  ttlMs?: number
  timeoutMs?: number
}

/** One account-scoped cache across sessions, with coalesced reads and bounded requests. */
export class CodexQuota {
  private identity?: string
  private cached?: QuotaView
  private attemptedAt?: number
  private pending?: { controller: AbortController; promise: Promise<QuotaView> }
  private disposed = false

  constructor(private readonly session: Pick<CodexSession, 'authenticate'>, private readonly connection: Connection = {}) {}

  async read(refresh = false): Promise<QuotaView> {
    if (this.disposed) return unavailable('Codex 组件已停用。')
    let auth: CodexAuth
    try { auth = await this.session.authenticate() }
    catch {
      this.reset()
      return unavailable('请更新本机 Codex 登录态后刷新额度。')
    }
    if (this.disposed) return unavailable('Codex 组件已停用。')
    const identity = identityOf(auth)
    if (identity !== this.identity) this.reset(identity)
    if (this.pending) return this.pending.promise
    const now = this.now()
    if (!refresh && this.cached && this.attemptedAt !== undefined && now >= this.attemptedAt
      && now - this.attemptedAt < (this.connection.ttlMs ?? 60000)) return this.cached
    const controller = new AbortController()
    this.attemptedAt = now
    const promise = this.load(auth, identity, controller)
    this.pending = { controller, promise }
    try { return await promise }
    finally { if (this.pending?.promise === promise) this.pending = undefined }
  }

  private now(): number { return (this.connection.now ?? Date.now)() }

  private reset(identity?: string): void {
    this.pending?.controller.abort()
    this.pending = undefined
    this.identity = identity
    this.cached = undefined
    this.attemptedAt = undefined
  }

  private async stillCurrent(identity: string): Promise<boolean> {
    if (this.disposed || this.identity !== identity) return false
    try {
      const auth = await this.session.authenticate()
      if (identityOf(auth) === identity) return !this.disposed && this.identity === identity
    } catch { /* Login changes must also invalidate a previously successful cache. */ }
    if (this.identity === identity) this.reset()
    return false
  }

  private async load(auth: CodexAuth, identity: string, controller: AbortController): Promise<QuotaView> {
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(this.connection.timeoutMs ?? 10000)])
      const response = await (this.connection.fetch ?? fetch)(this.connection.url ?? QUOTA_URL, {
        signal, redirect: 'error',
        headers: { Authorization: `Bearer ${auth.apiKey}`, ...auth.headers, originator: 'dsh_provider' },
      })
      if (!response.ok) {
        await response.body?.cancel()
        if (this.disposed || this.identity !== identity) return unavailable('Codex 额度读取已取消。')
        if (response.status === 401 || response.status === 403) {
          return this.cached = unavailable('Codex 登录状态不可用，请更新本机登录态后刷新。')
        }
        throw new Error('Codex quota refused')
      }
      const next = parseQuota(await response.json(), this.now())
      // A login file can change while the request is in flight. Never publish the previous account.
      if (!await this.stillCurrent(identity)) return unavailable('Codex 登录状态已变化或读取已取消，请刷新额度。')
      this.cached = next
      return next
    } catch {
      if (!await this.stillCurrent(identity)) return unavailable('Codex 登录状态已变化或读取已取消，请刷新额度。')
      this.cached = this.cached?.available
        ? { ...this.cached, stale: true, issue: '额度更新失败，显示上次成功读取的结果。' }
        : unavailable('暂时无法读取 Codex 额度，请稍后刷新。')
      return this.cached
    }
  }

  dispose(): void { this.disposed = true; this.reset() }
}
