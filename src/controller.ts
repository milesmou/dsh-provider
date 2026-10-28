import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { Action } from './remote.js'
import type { ControlAction, ControlReply } from './remote.js'
import type { WorkBuddySession } from './workbuddy.js'

export class ProviderController extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: { session(): WorkBuddySession; enabled(): boolean }) {
    super(ctx, 'codebuddyProvider')
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
}
