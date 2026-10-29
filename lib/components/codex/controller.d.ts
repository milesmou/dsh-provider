import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ControlAction, ControlReply } from './remote.js';
import type { CodexSession } from './session.js';
import type { CodexCatalog } from './catalog.js';
export declare class CodexController extends TypertRemoteService {
    private readonly options;
    constructor(ctx: Context, options: {
        session: CodexSession;
        catalog: CodexCatalog;
    });
    command(action: ControlAction): Promise<ControlReply>;
}
