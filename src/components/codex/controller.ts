import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { Action } from './remote.js'
import type { ControlAction, ControlReply } from './remote.js'
import type { CodexSession } from './session.js'
import type { CodexCatalog } from './catalog.js'
import type { CodexQuota } from './quota.js'
import type { QuotaView } from './remote.js'
import { modelDirectory } from '../../model-management.js'
import type { ModelDirectoryReply } from '../../model-management.js'

export class CodexController extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: { session: CodexSession; catalog: CodexCatalog; quota: CodexQuota }) { super(ctx, 'codexProvider') }

  @Remote
  async models(refresh: boolean): Promise<ModelDirectoryReply> {
    if (typeof refresh !== 'boolean') throw new TypeError('Invalid model refresh')
    if (refresh) await this.options.catalog.refresh()
    else await this.options.catalog.ready()
    return modelDirectory(this.options.catalog.models(), this.options.catalog.issue)
  }

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
