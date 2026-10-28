import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { Action } from './remote.js'
import type { ControlAction, ControlReply, CreditsReply, ContextsReply } from './remote.js'
import type { WorkBuddySession } from './session.js'
import type { ModelConfig } from './config.js'
import { projectRemain } from './credits.js'
import type { CreditLedger, SessionBalance } from './credits.js'
import { normalizeContextWindow } from './contexts.js'
import type { ContextWindowStore } from './contexts.js'

export class WorkBuddyController extends TypertRemoteService {
  /** One fetch of the account balance per session; later reads project from it. */
  private readonly balances = new Map<string, SessionBalance>()

  constructor(ctx: Context, private readonly options: {
    session(): WorkBuddySession
    ledger: CreditLedger
    enabled(): boolean
    /** Discovered models (names and base capacities) for the settings card. */
    models(): ModelConfig[]
    /** Per-model context-window overrides chosen in settings. */
    contexts: ContextWindowStore
  }) {
    super(ctx, 'workbuddyProvider')
  }

  @Remote
  async command(action: ControlAction): Promise<ControlReply> {
    Action.parse(action)
    if (!this.options.enabled()) return { configured: false, issue: '请先选择 WorkBuddy 登录模式。' }
    const session = this.options.session()
    try {
      if (action === 'login') return await session.beginLogin()
      if (action === 'poll') return await session.pollLogin()
      if (action === 'cancel') { session.cancelLogin(); return {} }
      if (action === 'desktop') await session.useDesktop()
      return await session.status()
    } catch (error) {
      return { issue: error instanceof LlmError ? error.message : 'WorkBuddy 操作失败，请重试。' }
    }
  }

  /**
   * Credit figures for one session: this conversation's accumulated spend from
   * the ledger, plus the account remaining balance. The balance is fetched from
   * the billing meter only once per session; afterwards it is projected locally
   * by subtracting the session's later spend. `refresh` forces a fresh fetch
   * (the manual refresh button). Disabled in API-key mode; a failed balance read
   * leaves `accountRemain` off rather than failing the whole read.
   */
  @Remote
  async credits(sessionId: string, refresh: boolean): Promise<CreditsReply> {
    if (!this.options.enabled()) return { enabled: false }
    const sessionUsed = this.options.ledger.of(sessionId)
    let balance = this.balances.get(sessionId)
    if (!balance || refresh === true) {
      let account: Awaited<ReturnType<WorkBuddySession['accountCredits']>>
      try { account = await this.options.session().accountCredits() } catch { account = undefined }
      // Keep the previous snapshot when a forced refresh fails, so the badge
      // does not fall back to a bare session total.
      if (account) {
        balance = { remain: account.remain, total: account.total, unit: account.unit,
          ...(account.plan ? { plan: account.plan } : {}), usedAtFetch: sessionUsed }
        this.balances.set(sessionId, balance)
      }
    }
    if (!balance) return { enabled: true, sessionUsed }
    return {
      enabled: true, sessionUsed,
      accountRemain: projectRemain(balance, sessionUsed),
      accountTotal: balance.total, unit: balance.unit,
      ...(balance.plan ? { plan: balance.plan } : {}),
    }
  }

  /**
   * Models advertised by the current catalog (base capacities, before overrides)
   * plus the saved per-model context-window overrides. Powers the component
   * settings card; available in both sign-in and API-key modes.
   */
  @Remote
  async contexts(): Promise<ContextsReply> {
    return {
      models: this.options.models().map(model => ({
        id: model.id,
        name: model.name ?? model.id,
        ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
      })),
      overrides: this.options.contexts.all(),
    }
  }

  /**
   * Save one model's context-window override. `tokens <= 0` clears it so the
   * model's own window applies. The next request's resolved model metadata reads
   * the override, which is what DSH's compaction budget uses.
   */
  @Remote
  async setContext(modelId: string, tokens: number): Promise<{ ok: boolean }> {
    this.options.contexts.set(modelId, normalizeContextWindow(tokens))
    void this.options.contexts.persist()
    this.ctx.emit('llm/adapters-updated')
    return { ok: true }
  }
}
