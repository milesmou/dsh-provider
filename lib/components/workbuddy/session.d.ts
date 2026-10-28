import type { CredentialProvider } from '@deepseek-ai/dsh-credentials';
export type WorkBuddyRegion = 'cn' | 'intl';
export declare const SITES: {
    readonly cn: {
        readonly endpoint: "https://copilot.tencent.com";
        readonly platform: "workbuddy";
        readonly file: "workbuddy-desktop.info";
        readonly app: "5.9.3";
        readonly cli: "2.165.0";
        readonly name: "WorkBuddy";
    };
    readonly intl: {
        readonly endpoint: "https://www.workbuddy.ai";
        readonly platform: "workbuddy-ai";
        readonly file: "workbuddy-desktop-ai.info";
        readonly app: "5.8.4";
        readonly cli: "2.161.0";
        readonly name: "workbuddy-ai";
    };
};
interface Login {
    access: string;
    refresh?: string;
    expires?: number;
    uid: string;
    domain: string;
    enterpriseId?: string;
    source: 'desktop' | 'browser';
}
export interface WorkBuddyStatus {
    configured: boolean;
    source?: 'desktop' | 'browser';
    issue?: string;
}
export declare function desktopAuthPath(region: WorkBuddyRegion, home?: string, platform?: NodeJS.Platform): string;
export declare function parseDesktop(value: unknown): Login;
export declare class WorkBuddySession {
    readonly region: WorkBuddyRegion;
    private readonly credentials;
    private readonly changed;
    private readonly transport;
    private readonly readDesktop;
    private readonly endpoint;
    private pending?;
    private generation;
    private polling?;
    private disposed;
    private readonly abort;
    readonly key: import("@deepseek-ai/dsh-credentials").CredentialKey;
    constructor(region: WorkBuddyRegion, credentials: () => CredentialProvider | undefined, changed: () => void, transport?: typeof fetch, readDesktop?: () => Promise<unknown>, endpoint?: string);
    headers(login: Login): Record<string, string>;
    private call;
    private stored;
    private browserLogin;
    status(): Promise<WorkBuddyStatus>;
    private desktop;
    authenticate(signal?: AbortSignal): Promise<{
        apiKey: string;
        headers: Record<string, string>;
    }>;
    private authentication;
    beginLogin(): Promise<{
        url: string;
    }>;
    pollLogin(): Promise<{
        pending: boolean;
        issue?: string;
    }>;
    private finishLogin;
    cancelLogin(): void;
    useDesktop(): Promise<void>;
    dispose(): void;
}
export {};
