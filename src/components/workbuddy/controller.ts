import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { Action } from './remote.js'
import type { ControlAction, ControlReply, CreditsReply, TurnCreditReply } from './remote.js'
import type { WorkBuddySession } from './session.js'
import { projectRemain, turnCreditIndex } from './credits.js'
import type { CreditLedger, CreditSessionEvent, SessionBalance } from './credits.js'

/** Structural slice of the host Session store this controller reads on demand. */
interface SessionReadFace {
  snapshotEvents(): readonly CreditSessionEvent[]
}
interface SessionStoreFace {
  get(id: string): SessionReadFace | undefined
}

export class WorkBuddyController extends TypertRemoteService {
  /** One fetch of the account balance per session; later reads project from it. */
  private readonly balances = new Map<string, SessionBalance>()
  /**
   * Turn-credit lookup per session snapshot. The Session log keeps one immutable
   * snapshot array until it appends, so the same array identity is a safe cache
   * key and each message read stays O(1) after the first one for that snapshot.
   */
  private readonly creditIndexes = new WeakMap<readonly CreditSessionEvent[], Map<string, number>>()

  constructor(private readonly host: Context, private readonly options: {
    session(): WorkBuddySession
    ledger: CreditLedger
    enabled(): boolean
  }) {
    super(host, 'workbuddyProvider')
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
   * Exact credit charge of the Turn that owns one finished assistant message.
   * Read from the durable session log: every assistant settlement keeps the
   * provider's `usage.credit`, so the figure survives reloads and needs no
   * extra bookkeeping. Unknown messages, other providers, and turns with no
   * disclosed charge return an empty reply; the UI then renders nothing.
   */
  @Remote
  async turnCredit(sessionId: string, messageId: string): Promise<TurnCreditReply> {
    const store = this.host.get('sessions') as unknown as SessionStoreFace | undefined
    const session = store?.get?.(sessionId)
    if (!session?.snapshotEvents) return {}
    try {
      const events = session.snapshotEvents()
      let index = this.creditIndexes.get(events)
      if (!index) {
        index = turnCreditIndex(events)
        this.creditIndexes.set(events, index)
      }
      const credits = index.get(messageId)
      return credits === undefined ? {} : { credits }
    } catch {
      return {}
    }
  }
}
