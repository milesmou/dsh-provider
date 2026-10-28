/**
 * WorkBuddy credit accounting. Two independent sources:
 *
 * - Per-session consumption: every chat completion's `usage` carries an exact
 *   `credit` charge (e.g. 0.01). The adapter reports each charge here, keyed by
 *   the DSH session id, so the UI can show what the current conversation spent.
 * - Account remaining: the billing meter endpoint returns the resource packages
 *   with cycle total / remaining / used capacities. That is the account balance.
 */
export interface AccountCredits {
    /** Sum of every package's cycle remaining capacity (the usable balance). */
    remain: number;
    /** Sum of every package's cycle total capacity. */
    total: number;
    /** Sum of every package's cycle used capacity. */
    used: number;
    /** Subscription plan name, when the endpoint names one. */
    plan?: string;
    /** Capacity unit the endpoint reports (usually `credits`). */
    unit: string;
}
/** Billing meter path, on the same host as the model API. Note: no `/v2` prefix. */
export declare const BILLING_PATH = "/billing/meter/get-user-resource-summary";
/**
 * Parse the billing meter's `data` object (the envelope's inner payload) into a
 * balance. Aggregates every resource package; falls back to `TotalCredits` for
 * the remaining balance when the endpoint reports no package list.
 */
export declare function parseBillingSummary(value: unknown): AccountCredits | undefined;
/**
 * A once-fetched account balance plus the session spend at that moment. The
 * badge fetches this snapshot when the session starts and then projects the
 * remaining balance locally from the ledger, so no further billing request is
 * made until the user asks for a refresh.
 */
export interface SessionBalance {
    /** Account remaining capacity at the moment of the fetch. */
    remain: number;
    /** Account total capacity at the moment of the fetch. */
    total: number;
    unit: string;
    plan?: string;
    /** This session's accumulated spend when the snapshot was taken. */
    usedAtFetch: number;
}
/**
 * Project the account remaining balance from a snapshot and the session's
 * current spend: anything spent after the fetch is subtracted, never below 0.
 */
export declare function projectRemain(balance: SessionBalance, sessionUsed: number): number;
/**
 * Per-session credit ledger. Holds one running total per DSH session id. When a
 * backing file is supplied the totals are loaded on construction and written
 * back on change, so reopening a session after a restart keeps its spend.
 */
export declare class CreditLedger {
    private readonly filename?;
    private readonly bySession;
    private saveTimer?;
    constructor(filename?: string | undefined);
    /** Add one request's credit charge to its session (ignored without a session or a valid charge). */
    add(sessionId: string | undefined, credit: number): void;
    /** Total credits charged to one session, or 0 when it has spent none yet. */
    of(sessionId: string | undefined): number;
    /** Flush any pending write immediately (used on disposal and by tests). */
    persist(): Promise<void>;
    private restore;
    private scheduleSave;
    private write;
}
