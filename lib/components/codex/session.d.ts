export interface CodexAuth {
    apiKey: string;
    headers: Record<string, string>;
}
type ObjectValue = Record<string, unknown>;
export declare const object: (value: unknown) => ObjectValue;
export declare function resolveCodexHome(configured: string, environment: string | undefined): string;
/** Read on every request so account changes and Codex's own token renewal take effect immediately. */
export declare class CodexSession {
    readonly home: string;
    constructor(home: string);
    authenticate(signal?: AbortSignal): Promise<CodexAuth>;
    status(): Promise<{
        configured: boolean;
        issue?: string;
    }>;
}
export {};
