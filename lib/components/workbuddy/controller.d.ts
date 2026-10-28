import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ControlAction, ControlReply } from './remote.js';
import type { WorkBuddySession } from './session.js';
export declare class WorkBuddyController extends TypertRemoteService {
    private readonly options;
    constructor(ctx: Context, options: {
        session(): WorkBuddySession;
        enabled(): boolean;
    });
    command(action: ControlAction): Promise<ControlReply>;
}
