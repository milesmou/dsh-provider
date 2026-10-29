import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { LlmError } from '@deepseek-ai/dsh-llm';
export const object = (value) => value && typeof value === 'object' && !Array.isArray(value)
    ? value : {};
export function resolveCodexHome(configured, environment) {
    const value = configured.trim() || environment?.trim();
    if (!value)
        return join(homedir(), '.codex');
    if (value === '~')
        return homedir();
    if (/^~[\\/]/.test(value))
        return resolve(homedir(), value.slice(2));
    return isAbsolute(value) ? value : resolve(value);
}
function claims(token) {
    try {
        return object(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')));
    }
    catch {
        return {};
    }
}
const loginIssue = '请先在本机运行 codex login，使用 ChatGPT 账号登录，然后刷新 Codex 组件。若凭据保存在系统钥匙串，请将 Codex 的 cli_auth_credentials_store 设为 file 后重新登录。';
/** Read on every request so account changes and Codex's own token renewal take effect immediately. */
export class CodexSession {
    home;
    constructor(home) {
        this.home = home;
    }
    async authenticate(signal) {
        signal?.throwIfAborted();
        let raw;
        try {
            raw = object(JSON.parse((await readFile(join(this.home, 'auth.json'), 'utf8')).replace(/^\uFEFF/, '')));
        }
        catch {
            throw new LlmError(`Codex: 无法读取本机登录凭据。${loginIssue}`, 'MISSING_CREDENTIAL');
        }
        signal?.throwIfAborted();
        const tokens = object(raw.tokens);
        const access = tokens.access_token;
        if ((raw.auth_mode !== undefined && raw.auth_mode !== 'chatgpt') || typeof access !== 'string' || !access.trim()) {
            throw new LlmError(`Codex: 未找到 ChatGPT 登录态。${loginIssue}`, 'MISSING_CREDENTIAL');
        }
        const payload = claims(access);
        if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
            throw new LlmError('Codex: 本机登录态已过期，请打开 Codex 更新登录，或重新运行 codex login，再刷新组件。', 'AUTH');
        }
        const account = tokens.account_id ?? object(payload['https://api.openai.com/auth']).chatgpt_account_id
            ?? object(claims(typeof tokens.id_token === 'string' ? tokens.id_token : '')['https://api.openai.com/auth']).chatgpt_account_id;
        if (typeof account !== 'string' || !account.trim() || /[^\x21-\x7e]/.test(account) || /[^\x21-\x7e]/.test(access)) {
            throw new LlmError(`Codex: 本机登录凭据格式不完整。${loginIssue}`, 'MISSING_CREDENTIAL');
        }
        return { apiKey: access, headers: { 'ChatGPT-Account-Id': account } };
    }
    async status() {
        try {
            await this.authenticate();
            return { configured: true };
        }
        catch (error) {
            return { configured: false, issue: error instanceof LlmError ? error.message : 'Codex 登录状态不可用。' };
        }
    }
}
//# sourceMappingURL=session.js.map