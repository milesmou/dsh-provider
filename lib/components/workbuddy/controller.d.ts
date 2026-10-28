import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ControlAction, ControlReply, CreditsReply } from './remote.js';
import type { WorkBuddySession } from './session.js';
import type { CreditLedger } from './credits.js';
export declare class WorkBuddyController extends TypertRemoteService {
    private readonly options;
    private accountCache?;
    constructor(ctx: Context, options: {
        session(): WorkBuddySession;
        ledger: CreditLedger;
        enabled(): boolean;
    });
    command(action: ControlAction): Promise<ControlReply>;
    /**
     * Credit figures for one session: this conversation's accumulated spend from
     * the ledger, plus the account's remaining balance from the billing meter.
     * Disabled in API-key mode (no WorkBuddy account to meter). A missing balance
     * leaves `accountRemain` off rather than failing the whole read.
     */
    credits(sessionId: string): Promise<CreditsReply>;
}
