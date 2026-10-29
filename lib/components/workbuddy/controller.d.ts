import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ControlAction, ControlReply, CreditsReply } from './remote.js';
import type { WorkBuddySession } from './session.js';
import type { CreditLedger } from './credits.js';
import type { ModelCatalog } from './catalog.js';
import type { ModelDirectoryReply } from '../../model-management.js';
import type { ApiCredits } from './api-credits.js';
export declare class WorkBuddyController extends TypertRemoteService {
    private readonly options;
    /** One fetch of the account balance per session; later reads project from it. */
    private readonly balances;
    constructor(ctx: Context, options: {
        session(): WorkBuddySession;
        ledger: CreditLedger;
        enabled(): boolean;
        catalog?(): ModelCatalog | undefined;
        apiCredits?(): Pick<ApiCredits, 'read'> | undefined;
    });
    models(refresh: boolean): Promise<ModelDirectoryReply>;
    command(action: ControlAction): Promise<ControlReply>;
    /**
     * Credit figures for one session: this conversation's accumulated spend from
     * the ledger, plus the account remaining balance. The balance is fetched from
     * the billing meter only once per session; afterwards it is projected locally
     * by subtracting the session's later spend. `refresh` forces a fresh fetch
     * (the manual refresh button). API-key mode uses its account-shared cache; a failed balance read
     * leaves `accountRemain` off rather than failing the whole read.
     */
    credits(sessionId: string, refresh: boolean): Promise<CreditsReply>;
}
