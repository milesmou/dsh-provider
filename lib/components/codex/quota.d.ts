import type { CodexSession } from './session.js';
import type { QuotaView } from './remote.js';
export declare const QUOTA_URL = "https://chatgpt.com/backend-api/wham/usage";
/** Only quota fields leave the Host; account identifiers and credentials are discarded. */
export declare function parseQuota(value: unknown, now?: number): QuotaView;
interface Connection {
    fetch?: typeof fetch;
    url?: string;
    now?: () => number;
    ttlMs?: number;
    timeoutMs?: number;
}
/** One account-scoped cache across sessions, with coalesced reads and bounded requests. */
export declare class CodexQuota {
    private readonly session;
    private readonly connection;
    private identity?;
    private cached?;
    private attemptedAt?;
    private pending?;
    private disposed;
    constructor(session: Pick<CodexSession, 'authenticate'>, connection?: Connection);
    read(refresh?: boolean): Promise<QuotaView>;
    private now;
    private reset;
    private stillCurrent;
    private load;
    dispose(): void;
}
export {};
