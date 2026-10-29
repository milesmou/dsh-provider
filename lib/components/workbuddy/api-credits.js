import { createHash } from 'node:crypto';
import { isOfficialCodeBuddyEndpoint } from './config.js';
import { codeBuddyApiHeaders } from './identity.js';
import { projectRemain } from './credits.js';
export const API_BILLING_PATH = '/v2/billing/meter/get-user-resource';
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const round = (value) => Math.round(value * 1e6) / 1e6;
function capacity(value) {
    if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)))
        return;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function time(value) {
    if (value === undefined || value === null || value === '' || value === 0)
        return;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0)
        return value < 1e12 ? value * 1000 : value;
    if (typeof value !== 'string')
        throw new Error('Invalid billing timestamp');
    // The domestic billing service also returns unzoned China Standard Time.
    const parsed = Date.parse(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(value)
        ? value.replace(' ', 'T') + '+08:00' : value);
    if (!Number.isFinite(parsed))
        throw new Error('Invalid billing timestamp');
    return parsed;
}
/** Project only complete, current credit resources; a partial directory is not a balance. */
export function parseApiCredits(value, now = Date.now()) {
    const envelope = object(value);
    const response = object(object(envelope.data).Response);
    const data = object(response.Data);
    const accounts = data.Accounts;
    const count = data.TotalCount;
    if (envelope.code !== 0 || response.Error || !Array.isArray(accounts)
        || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count !== accounts.length) {
        throw new Error('Incomplete billing resources');
    }
    let remain = 0, total = 0, used = 0;
    for (const raw of accounts) {
        const item = object(raw);
        if (typeof item.ProductCode !== 'string' || typeof item.CapacityUnit !== 'string' || typeof item.Status !== 'number') {
            throw new Error('Billing resource metadata missing');
        }
        if (item.ProductCode !== 'p_tcaca' || item.CapacityUnit !== 'credits')
            continue;
        if (![0, 3].includes(item.Status))
            continue;
        const expires = time(item.ExpiredTime), starts = time(item.DeductionStartTime);
        if (expires !== undefined && expires <= now || starts !== undefined && starts > now)
            continue;
        const remaining = capacity(item.CycleCapacityRemainPrecise ?? item.CycleCapacityRemain);
        const size = capacity(item.CycleCapacitySizePrecise ?? item.CycleCapacitySize);
        const consumed = capacity(item.CycleCapacityUsedPrecise ?? item.CycleCapacityUsed);
        if (remaining === undefined || size === undefined || consumed === undefined) {
            throw new Error('Billing capacities missing');
        }
        remain += remaining;
        total += size;
        used += consumed;
    }
    if (![remain, total, used].every(Number.isFinite))
        throw new Error('Invalid billing capacities');
    return { remain: round(remain), total: round(total), used: round(used), unit: 'credits' };
}
/** Account-shared API-key balance cache. Secrets and account identifiers never leave the Host. */
export class ApiCredits {
    ledger;
    connection;
    identity;
    snapshot;
    attemptedAt;
    pending;
    disposed = false;
    revision = 0;
    constructor(ledger, connection) {
        this.ledger = ledger;
        this.connection = connection;
        if (!isOfficialCodeBuddyEndpoint(connection.baseURL))
            throw new Error('Official CodeBuddy endpoint required');
    }
    now() { return (this.connection.now ?? Date.now)(); }
    keyIdentity(key) {
        return createHash('sha256').update(this.connection.baseURL).update('\0').update(key).digest('hex');
    }
    ledgerKey(identity, sessionId) {
        return `api:${identity}:${sessionId === undefined ? 'total' : 'session:' + sessionId}`;
    }
    /** Bind charges to the credential used by the request, even if it changes during streaming. */
    record(sessionId, credit, apiKey) {
        if (this.disposed || !Number.isFinite(credit) || credit < 0)
            return;
        const identity = this.keyIdentity(apiKey);
        this.ledger.add(this.ledgerKey(identity), credit);
        if (sessionId)
            this.ledger.add(this.ledgerKey(identity, sessionId), credit);
    }
    invalidate() { this.reset(); }
    reset(identity) {
        this.revision++;
        this.pending?.controller.abort();
        this.pending = undefined;
        this.identity = identity;
        this.snapshot = undefined;
        this.attemptedAt = undefined;
    }
    async stillCurrent(identity, revision) {
        if (this.disposed || this.identity !== identity || this.revision !== revision)
            return false;
        try {
            const key = await this.connection.resolveApiKey();
            if (key && this.keyIdentity(key) === identity)
                return !this.disposed && this.identity === identity && this.revision === revision;
        }
        catch { /* Missing or changed keys invalidate cached account data. */ }
        if (this.identity === identity && this.revision === revision)
            this.reset();
        return false;
    }
    async read(sessionId, refresh = false) {
        if (this.disposed)
            return { enabled: false };
        let apiKey;
        try {
            apiKey = await this.connection.resolveApiKey();
            if (!apiKey)
                throw new Error();
        }
        catch {
            this.reset();
            return { enabled: true, mode: 'api', issue: '请保存有效的 CodeBuddy API Key 后刷新余额。' };
        }
        if (this.disposed)
            return { enabled: false };
        const identity = this.keyIdentity(apiKey);
        if (identity !== this.identity)
            this.reset(identity);
        const revision = this.revision;
        const now = this.now();
        if (this.pending)
            await this.pending.promise;
        else if (refresh || !this.snapshot || this.attemptedAt === undefined || now < this.attemptedAt
            || now - this.attemptedAt >= (this.connection.ttlMs ?? 60000)) {
            const controller = new AbortController();
            this.attemptedAt = now;
            const promise = this.load(apiKey, identity, controller, revision);
            this.pending = { controller, promise };
            try {
                await promise;
            }
            finally {
                if (this.pending?.promise === promise)
                    this.pending = undefined;
            }
        }
        if (!await this.stillCurrent(identity, revision))
            return { enabled: true, mode: 'api', issue: '登录凭据已变化，请刷新余额。' };
        const { balance, ...state } = this.snapshot ?? {};
        return { enabled: true, mode: 'api', sessionUsed: this.ledger.of(this.ledgerKey(identity, sessionId)), ...state,
            ...(balance ? { accountRemain: projectRemain(balance, this.ledger.of(this.ledgerKey(identity))),
                accountTotal: balance.total, unit: balance.unit } : {}),
        };
    }
    async load(apiKey, identity, controller, revision) {
        try {
            const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(this.connection.timeoutMs ?? 10000)]);
            const response = await (this.connection.fetch ?? fetch)(new URL(API_BILLING_PATH, this.connection.baseURL).href, {
                method: 'POST', redirect: 'error', signal,
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`,
                    'X-API-Key': apiKey, ...codeBuddyApiHeaders() },
                body: JSON.stringify({ ProductCode: 'p_tcaca', Status: [0, 3] }),
            });
            if (!response.ok) {
                await response.body?.cancel();
                if (!await this.stillCurrent(identity, revision))
                    return;
                if (response.status === 401 || response.status === 403) {
                    this.snapshot = { issue: 'CodeBuddy API Key 无效或无权读取余额，请检查密钥后刷新。' };
                    return;
                }
                throw new Error('Billing request refused');
            }
            const account = parseApiCredits(await response.json(), this.now());
            if (!await this.stillCurrent(identity, revision))
                return;
            this.snapshot = { balance: { ...account, usedAtFetch: this.ledger.of(this.ledgerKey(identity)) }, updatedAt: this.now() };
        }
        catch {
            if (!await this.stillCurrent(identity, revision))
                return;
            this.snapshot = this.snapshot?.balance
                ? { ...this.snapshot, stale: true, issue: '余额更新失败，显示上次读取的缓存。' }
                : { issue: '暂时无法读取 CodeBuddy 余额，请稍后刷新。' };
        }
    }
    dispose() { this.disposed = true; this.reset(); }
}
//# sourceMappingURL=api-credits.js.map