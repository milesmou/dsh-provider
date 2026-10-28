import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ControlAction, ControlReply, CreditsReply, ContextsReply } from './remote.js';
import type { WorkBuddySession } from './session.js';
import type { ModelConfig } from './config.js';
import type { CreditLedger } from './credits.js';
import type { ContextWindowStore } from './contexts.js';
export declare class WorkBuddyController extends TypertRemoteService {
    private readonly options;
    /** One fetch of the account balance per session; later reads project from it. */
    private readonly balances;
    constructor(ctx: Context, options: {
        session(): WorkBuddySession;
        ledger: CreditLedger;
        enabled(): boolean;
        /** Discovered models (names and base capacities) for the settings card. */
        models(): ModelConfig[];
        /** Per-model context-window overrides chosen in settings. */
        contexts: ContextWindowStore;
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
     * Models advertised by the current catalog (base capacities, before overrides)
     * plus the saved per-model context-window overrides. Powers the component
     * settings card; available in both sign-in and API-key modes.
     */
    contexts(): Promise<ContextsReply>;
    /**
     * Save one model's context-window override. `tokens <= 0` clears it so the
     * model's own window applies. The next request's resolved model metadata reads
     * the override, which is what DSH's compaction budget uses.
     */
    setContext(modelId: string, tokens: number): Promise<{
        ok: boolean;
    }>;
}
