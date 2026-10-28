import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ControlAction, ControlReply } from './remote.js';
import type { WorkBuddySession } from './workbuddy.js';
export declare class ProviderController extends TypertRemoteService {
    private readonly options;
    constructor(ctx: Context, options: {
        session(): WorkBuddySession;
        enabled(): boolean;
    });
    command(action: ControlAction): Promise<ControlReply>;
}
