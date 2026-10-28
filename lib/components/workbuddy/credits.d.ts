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
 * Per-session credit ledger. Holds one running total per DSH session id for the
 * life of this process; a fresh plugin load starts every session at zero.
 */
export declare class CreditLedger {
    private readonly bySession;
    /** Add one request's credit charge to its session (ignored without a session or a valid charge). */
    add(sessionId: string | undefined, credit: number): void;
    /** Total credits charged to one session, or 0 when it has spent none yet. */
    of(sessionId: string | undefined): number;
}
