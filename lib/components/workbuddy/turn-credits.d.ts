import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { CreditLedger } from './credits.js';
import type { TurnCreditsReply } from './remote.js';
/** Exact provider charges grouped by DSH turn, independently of account balances. */
export declare class TurnCredits {
    private readonly ledger;
    private readonly active;
    private disposed;
    constructor(ledger: CreditLedger);
    observe(sessionId: string, event: SessionEvent): void;
    forget(sessionId: string): void;
    /** Capture the owning turn before the request; a late reply cannot charge a later turn. */
    begin(sessionId: string | undefined): ((credit?: number) => void) | undefined;
    read(sessionId: string, turn: number): TurnCreditsReply;
    dispose(): Promise<void>;
}
