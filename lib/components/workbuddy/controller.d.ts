import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ControlAction, ControlReply, CreditsReply, TurnCreditReply } from './remote.js';
import type { WorkBuddySession } from './session.js';
import type { CreditLedger } from './credits.js';
export declare class WorkBuddyController extends TypertRemoteService {
    private readonly host;
    private readonly options;
    /** One fetch of the account balance per session; later reads project from it. */
    private readonly balances;
    /**
     * Turn-credit lookup per session snapshot. The Session log keeps one immutable
     * snapshot array until it appends, so the same array identity is a safe cache
     * key and each message read stays O(1) after the first one for that snapshot.
     */
    private readonly creditIndexes;
    constructor(host: Context, options: {
        session(): WorkBuddySession;
        ledger: CreditLedger;
        enabled(): boolean;
    });
    command(action: ControlAction): Promise<ControlReply>;
    /**
     * Credit figures for one session: this conversation's accumulated spend from
     * the ledger, plus the account remaining balance. The balance is fetched from
     * the billing meter only once per session; afterwards it is projected locally
     * by subtracting the session's later spend. `refresh` forces a fresh fetch
     * (the manual refresh button). Disabled in API-key mode; a failed balance read
     * leaves `accountRemain` off rather than failing the whole read.
     */
    credits(sessionId: string, refresh: boolean): Promise<CreditsReply>;
    /**
     * Exact credit charge of the Turn that owns one finished assistant message.
     * Read from the durable session log: every assistant settlement keeps the
     * provider's `usage.credit`, so the figure survives reloads and needs no
     * extra bookkeeping. Unknown messages, other providers, and turns with no
     * disclosed charge return an empty reply; the UI then renders nothing.
     */
    turnCredit(sessionId: string, messageId: string): Promise<TurnCreditReply>;
}
