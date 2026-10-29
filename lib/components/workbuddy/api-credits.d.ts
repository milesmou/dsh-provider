import type { AccountCredits, CreditLedger } from './credits.js';
import type { CreditsReply } from './remote.js';
export declare const API_BILLING_PATH = "/v2/billing/meter/get-user-resource";
/** Project only complete, current credit resources; a partial directory is not a balance. */
export declare function parseApiCredits(value: unknown, now?: number): AccountCredits;
interface Connection {
    baseURL: string;
    resolveApiKey(): Promise<string>;
    fetch?: typeof fetch;
    now?: () => number;
    ttlMs?: number;
    timeoutMs?: number;
}
/** Account-shared API-key balance cache. Secrets and account identifiers never leave the Host. */
export declare class ApiCredits {
    private readonly ledger;
    private readonly connection;
    private identity?;
    private snapshot?;
    private attemptedAt?;
    private pending?;
    private disposed;
    private revision;
    constructor(ledger: CreditLedger, connection: Connection);
    private now;
    private keyIdentity;
    private ledgerKey;
    /** Bind charges to the credential used by the request, even if it changes during streaming. */
    record(sessionId: string | undefined, credit: number, apiKey: string): void;
    invalidate(): void;
    private reset;
    private stillCurrent;
    read(sessionId: string, refresh?: boolean): Promise<CreditsReply>;
    private load;
    dispose(): void;
}
export {};
