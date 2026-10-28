import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'

export type WorkBuddyRegion = 'cn' | 'intl'
export const SITES = {
  cn: { endpoint: 'https://copilot.tencent.com', platform: 'workbuddy', file: 'workbuddy-desktop.info', app: '5.9.3', cli: '2.165.0', name: 'WorkBuddy' },
  intl: { endpoint: 'https://www.workbuddy.ai', platform: 'workbuddy-ai', file: 'workbuddy-desktop-ai.info', app: '5.8.4', cli: '2.161.0', name: 'workbuddy-ai' },
} as const

interface Login {
  access: string
  refresh?: string
  expires?: number
  uid: string
  domain: string
  enterpriseId?: string
  source: 'desktop' | 'browser'
}
export interface WorkBuddyStatus {
  configured: boolean
  source?: 'desktop' | 'browser'
  issue?: string
}
type ObjectValue = Record<string, unknown>
const obj = (value: unknown): ObjectValue => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {}
const str = (value: unknown): string => typeof value === 'string' ? value : ''
const validHeader = (value: string): boolean => !!value && /^[\x21-\x7e]+$/.test(value)

export function desktopAuthPath(region: WorkBuddyRegion, home = homedir(), platform = process.platform): string {
  const base = platform === 'win32' ? join(home, 'AppData', 'Local', 'CodeBuddyExtension')
    : platform === 'darwin' ? join(home, 'Library', 'Application Support', 'CodeBuddyExtension')
    : join(home, '.local', 'share', 'CodeBuddyExtension')
  return join(base, 'Data', 'Public', 'auth', SITES[region].file)
}

export function parseDesktop(value: unknown): Login {
  const root = obj(value), auth = obj(root.auth), account = obj(root.account)
  if (typeof auth.accessToken === 'object' && auth.accessToken !== null) {
    throw new LlmError('WorkBuddy 的本机凭据已加密，请在设置 → 模型中选择浏览器登录。', 'ENCRYPTED_CREDENTIAL')
  }
  const access = str(auth.accessToken), uid = str(account.uid)
  if (!validHeader(access) || !validHeader(uid)) throw new LlmError('请先登录 WorkBuddy，或在插件中使用浏览器登录。', 'MISSING_CREDENTIAL')
  const expires = typeof auth.expiresAt === 'number' ? auth.expiresAt : undefined
  if (expires && expires <= Date.now()) throw new LlmError('WorkBuddy 本机登录已过期，请打开 WorkBuddy 刷新登录，或使用浏览器登录。', 'AUTH')
  return { access, uid, domain: str(auth.domain), enterpriseId: str(account.enterpriseId) || undefined, expires, source: 'desktop' }
}

export class WorkBuddySession {
  private pending?: { state: string; url: string; deadline: number; generation: number }
  private generation = 0
  private polling?: Promise<{ pending: boolean; issue?: string }>
  private disposed = false
  private readonly abort = new AbortController()
  readonly key

  constructor(readonly region: WorkBuddyRegion, private readonly credentials: () => CredentialProvider | undefined,
    private readonly changed: () => void,
    private readonly transport: typeof fetch = fetch,
    private readonly readDesktop: () => Promise<unknown> = async () => JSON.parse(await readFile(desktopAuthPath(region), 'utf8')),
    private readonly endpoint: string = SITES[region].endpoint,
  ) { this.key = credentialKey('llm-codebuddy-provider', 'workbuddy-' + region) }

  headers(login: Login): Record<string, string> {
    const site = SITES[this.region]
    const headers: Record<string, string> = {
      Authorization: 'Bearer ' + login.access, 'X-User-Id': login.uid,
      'X-Domain': login.domain || new URL(this.endpoint).host,
      'User-Agent': `WorkBuddy/${site.app} ${site.name}/${site.app} CLI/${site.cli}`,
      'X-Product': 'SaaS', 'X-IDE-Type': 'WorkBuddy', 'X-IDE-Name': 'WorkBuddy',
      'X-IDE-Version': site.app, 'X-Requested-With': 'XMLHttpRequest',
      'X-Agent-Intent': 'craft', 'X-Agent-Purpose': 'conversation', 'X-Agent-Type': 'main',
    }
    if (this.region === 'cn') headers['X-Agent-Runtime'] = 'local-agent'
    if (login.enterpriseId) { headers['X-Enterprise-Id'] = login.enterpriseId; headers['X-Tenant-Id'] = login.enterpriseId }
    if (Object.values(headers).some(value => /[^\x20-\x7e]/.test(value))) {
      throw new LlmError('WorkBuddy 登录数据无效，请重新登录。', 'AUTH')
    }
    return headers
  }

  private async call(path: string, method: string, headers: Record<string, string> = {}, body?: object): Promise<ObjectValue> {
    this.abort.signal.throwIfAborted()
    let response: Response
    try {
      response = await this.transport(this.endpoint + path, {
        method, redirect: 'error', headers: { Accept: 'application/json', 'Content-Type': 'application/json',
          'User-Agent': 'WorkBuddy/' + SITES[this.region].app, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(15000)]),
      })
      const envelope = obj(await response.json())
      if (response.ok && envelope.code === 0) return obj(envelope.data)
      if (response.ok && [11217, 12151].includes(Number(envelope.code))) return { waiting: true }
      throw new LlmError('WorkBuddy 登录请求被拒绝，请重试或重新登录。', response.status === 401 ? 'AUTH' : 'HTTP_ERROR')
    } catch (error) {
      if (error instanceof LlmError) throw error
      throw new LlmError('无法连接 WorkBuddy 登录服务，请检查网络后重试。', 'NETWORK')
    }
  }

  private stored(value: unknown): Login | undefined {
    const data = obj(value)
    if (data.source !== 'browser' || !validHeader(str(data.access)) || !validHeader(str(data.uid))) return undefined
    return { access: str(data.access), refresh: str(data.refresh), uid: str(data.uid), domain: str(data.domain),
      enterpriseId: str(data.enterpriseId) || undefined, expires: typeof data.expires === 'number' ? data.expires : undefined, source: 'browser' }
  }

  private async browserLogin(): Promise<Login | undefined> {
    const record = await this.credentials()?.readRecord(this.key)
    return record?.kind === 'grant' ? this.stored(record.payload) : undefined
  }

  async status(): Promise<WorkBuddyStatus> {
    try {
      const browser = await this.browserLogin()
      if (browser) return { configured: true, source: 'browser' }
      await this.desktop()
      return { configured: true, source: 'desktop' }
    } catch (error) { return { configured: false, issue: error instanceof LlmError ? error.message : '无法读取 WorkBuddy 登录状态。' } }
  }

  private async desktop(): Promise<Login> {
    try { return parseDesktop(await this.readDesktop()) }
    catch (error) {
      if (error instanceof LlmError) throw error
      throw new LlmError('未找到 WorkBuddy 本机登录，请先登录 WorkBuddy，或使用浏览器登录。', 'MISSING_CREDENTIAL')
    }
  }

  async authenticate(signal?: AbortSignal): Promise<{ apiKey: string; headers: Record<string, string> }> {
    signal?.throwIfAborted()
    const pending = this.authentication()
    if (!signal) return pending
    return new Promise((resolve, reject) => {
      const abort = () => reject(new LlmError('WorkBuddy 请求已取消。', 'ABORTED'))
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      void pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    })
  }

  private async authentication(): Promise<{ apiKey: string; headers: Record<string, string> }> {
    let login = await this.browserLogin()
    if (login?.expires && login.expires <= Date.now() + 60000) {
      const credentials = this.credentials()!
      try {
        const record = await credentials.modifyRecord(this.key, async current => {
          const latest = current?.kind === 'grant' ? this.stored(current.payload) : undefined
          if (!latest || !latest.expires || latest.expires > Date.now() + 60000) return undefined
          if (!latest.refresh) throw new LlmError('WorkBuddy 登录已过期，请重新进行浏览器登录。', 'AUTH')
          const data = await this.call('/v2/plugin/auth/token/refresh', 'POST', {
            'X-Refresh-Token': latest.refresh, 'X-Domain': latest.domain || new URL(this.endpoint).host,
            'X-Auth-Refresh-Source': 'plugin',
          }, {})
          const access = str(data.accessToken)
          if (!validHeader(access)) throw new LlmError('WorkBuddy 登录刷新失败，请重新登录。', 'AUTH')
          return { kind: 'grant', payload: { ...latest, access, refresh: str(data.refreshToken) || latest.refresh,
            expires: typeof data.expiresAt === 'number' ? data.expiresAt : Date.now() + Number(data.expiresIn || 3600) * 1000 } }
        })
        login = record?.kind === 'grant' ? this.stored(record.payload) : undefined
        if (!login) throw new LlmError('WorkBuddy 登录已移除，请重新登录。', 'AUTH')
      } catch (error) {
        if (!login || (login.expires && login.expires <= Date.now())) throw error
        // A transient refresh failure can still use the unexpired access token.
      }
    }
    login ??= await this.desktop()
    return { apiKey: login.access, headers: this.headers(login) }
  }

  async beginLogin(): Promise<{ url: string }> {
    this.cancelLogin()
    const generation = this.generation
    if (!this.credentials()) throw new LlmError('DSH 凭据存储不可用。', 'MISSING_CREDENTIAL')
    const data = await this.call('/v2/plugin/auth/state?platform=' + SITES[this.region].platform, 'POST', {
      'X-No-Authorization': 'true', 'X-No-User-Id': 'true', 'X-No-Enterprise-Id': 'true', 'X-No-Department-Info': 'true',
    }, {})
    const url = new URL(str(data.authUrl))
    if (url.protocol !== 'https:' || !str(data.state) || generation !== this.generation || this.disposed) throw new LlmError('无法创建 WorkBuddy 登录，请重试。', 'AUTH')
    url.searchParams.set('version', '2.0.0')
    url.searchParams.set('loginSessionId', randomUUID().replaceAll('-', ''))
    this.pending = { state: str(data.state), url: url.href, deadline: Date.now() + 300000, generation }
    return { url: url.href }
  }

  pollLogin(): Promise<{ pending: boolean; issue?: string }> {
    if (this.polling) return this.polling
    const task = this.finishLogin().finally(() => { if (this.polling === task) this.polling = undefined })
    this.polling = task
    return task
  }

  private async finishLogin(): Promise<{ pending: boolean; issue?: string }> {
    const pending = this.pending
    if (!pending || pending.deadline < Date.now()) return { pending: false, issue: '登录已取消或超时，请重试。' }
    try {
      const query = '?state=' + encodeURIComponent(pending.state)
      const token = await this.call('/v2/plugin/auth/token' + query, 'GET')
      if (token.waiting) return { pending: true }
      const access = str(token.accessToken)
      if (!validHeader(access)) throw new LlmError('WorkBuddy 未返回有效登录信息，请重试。', 'AUTH')
      const account = await this.call('/v2/plugin/login/account' + query, 'GET', {
        Authorization: 'Bearer ' + access, 'X-Domain': str(token.domain) || new URL(this.endpoint).host,
        'X-No-User-Id': 'true', 'X-No-Enterprise-Id': 'true',
      })
      if (account.waiting) return { pending: true }
      if (!validHeader(str(account.uid))) throw new LlmError('无法读取 WorkBuddy 账号，请重试。', 'AUTH')
      if (pending !== this.pending || pending.generation !== this.generation || this.disposed) return { pending: false, issue: '登录已取消。' }
      const login: Login = { access, refresh: str(token.refreshToken), uid: str(account.uid), domain: str(token.domain),
        enterpriseId: str(account.enterpriseId) || undefined, source: 'browser',
        expires: typeof token.expiresAt === 'number' ? token.expiresAt : Date.now() + Number(token.expiresIn || 3600) * 1000 }
      await this.credentials()!.modifyRecord(this.key, async () => {
        if (pending !== this.pending || this.disposed) return undefined
        return { kind: 'grant', payload: { ...login } }
      })
      this.pending = undefined
      this.changed()
      return { pending: false }
    } catch (error) {
      if (pending === this.pending) this.pending = undefined
      return { pending: false, issue: error instanceof LlmError ? error.message : 'WorkBuddy 登录失败，请重试。' }
    }
  }

  cancelLogin(): void { this.generation++; this.pending = undefined; this.polling = undefined }
  async useDesktop(): Promise<void> {
    this.cancelLogin()
    await this.credentials()?.deleteRecord(this.key)
    this.changed()
  }
  dispose(): void { this.disposed = true; this.cancelLogin(); this.abort.abort() }
}
