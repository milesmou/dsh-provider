import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { Action } from './remote.js'
import type { ControlAction, ControlReply, CreditsReply } from './remote.js'
import type { WorkBuddySession } from './session.js'
import type { CreditLedger } from './credits.js'

export class WorkBuddyController extends TypertRemoteService {
  private accountCache?: { at: number; value: Awaited<ReturnType<WorkBuddySession['accountCredits']>> }

  constructor(ctx: Context, private readonly options: {
    session(): WorkBuddySession
    ledger: CreditLedger
    enabled(): boolean
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
   * the ledger, plus the account's remaining balance from the billing meter.
   * Disabled in API-key mode (no WorkBuddy account to meter). A missing balance
   * leaves `accountRemain` off rather than failing the whole read.
   */
  @Remote
  async credits(sessionId: string): Promise<CreditsReply> {
    if (!this.options.enabled()) return { enabled: false }
    const sessionUsed = this.options.ledger.of(sessionId)
    // The client polls this; cache the billing read so a 5s badge refresh does
    // not become a 5s account-billing request.
    const now = Date.now()
    if (!this.accountCache || now - this.accountCache.at > 20000) {
      let value: Awaited<ReturnType<WorkBuddySession['accountCredits']>>
      try { value = await this.options.session().accountCredits() } catch { value = undefined }
      this.accountCache = { at: now, value }
    }
    const account = this.accountCache.value
    return {
      enabled: true, sessionUsed,
      ...(account ? { accountRemain: account.remain, accountTotal: account.total, unit: account.unit,
        ...(account.plan ? { plan: account.plan } : {}) } : {}),
    }
  }
}
