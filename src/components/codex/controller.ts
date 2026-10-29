import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { Action } from './remote.js'
import type { ControlAction, ControlReply } from './remote.js'
import type { CodexSession } from './session.js'
import type { CodexCatalog } from './catalog.js'
import type { CodexQuota } from './quota.js'
import type { QuotaView } from './remote.js'

export class CodexController extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: { session: CodexSession; catalog: CodexCatalog; quota: CodexQuota }) { super(ctx, 'codexProvider') }

  @Remote
  async quota(refresh: boolean): Promise<QuotaView> {
    if (typeof refresh !== 'boolean') throw new TypeError('Invalid quota refresh')
    return this.options.quota.read(refresh)
  }

  @Remote
  async command(action: ControlAction): Promise<ControlReply> {
    Action.parse(action)
    const { session, catalog } = this.options
    if (action === 'refresh') await catalog.refresh()
    const status = await session.status()
    return { ...status, models: catalog.models().length, source: catalog.source, issue: status.issue ?? catalog.issue }
  }
}
