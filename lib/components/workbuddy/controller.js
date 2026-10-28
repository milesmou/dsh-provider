var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { LlmError } from '@deepseek-ai/dsh-llm';
import { Action } from './remote.js';
import { projectRemain } from './credits.js';
import { normalizeContextWindow } from './contexts.js';
let WorkBuddyController = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _command_decorators;
    let _credits_decorators;
    let _contexts_decorators;
    let _setContext_decorators;
    return class WorkBuddyController extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _command_decorators = [Remote];
            _credits_decorators = [Remote];
            _contexts_decorators = [Remote];
            _setContext_decorators = [Remote];
            __esDecorate(this, null, _command_decorators, { kind: "method", name: "command", static: false, private: false, access: { has: obj => "command" in obj, get: obj => obj.command }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _credits_decorators, { kind: "method", name: "credits", static: false, private: false, access: { has: obj => "credits" in obj, get: obj => obj.credits }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _contexts_decorators, { kind: "method", name: "contexts", static: false, private: false, access: { has: obj => "contexts" in obj, get: obj => obj.contexts }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setContext_decorators, { kind: "method", name: "setContext", static: false, private: false, access: { has: obj => "setContext" in obj, get: obj => obj.setContext }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        options = __runInitializers(this, _instanceExtraInitializers);
        /** One fetch of the account balance per session; later reads project from it. */
        balances = new Map();
        constructor(ctx, options) {
            super(ctx, 'workbuddyProvider');
            this.options = options;
        }
        async command(action) {
            Action.parse(action);
            if (!this.options.enabled())
                return { configured: false, issue: '请先选择 WorkBuddy 登录模式。' };
            const session = this.options.session();
            try {
                if (action === 'login')
                    return await session.beginLogin();
                if (action === 'poll')
                    return await session.pollLogin();
                if (action === 'cancel') {
                    session.cancelLogin();
                    return {};
                }
                if (action === 'desktop')
                    await session.useDesktop();
                return await session.status();
            }
            catch (error) {
                return { issue: error instanceof LlmError ? error.message : 'WorkBuddy 操作失败，请重试。' };
            }
        }
        /**
         * Credit figures for one session: this conversation's accumulated spend from
         * the ledger, plus the account remaining balance. The balance is fetched from
         * the billing meter only once per session; afterwards it is projected locally
         * by subtracting the session's later spend. `refresh` forces a fresh fetch
         * (the manual refresh button). Disabled in API-key mode; a failed balance read
         * leaves `accountRemain` off rather than failing the whole read.
         */
        async credits(sessionId, refresh) {
            if (!this.options.enabled())
                return { enabled: false };
            const sessionUsed = this.options.ledger.of(sessionId);
            let balance = this.balances.get(sessionId);
            if (!balance || refresh === true) {
                let account;
                try {
                    account = await this.options.session().accountCredits();
                }
                catch {
                    account = undefined;
                }
                // Keep the previous snapshot when a forced refresh fails, so the badge
                // does not fall back to a bare session total.
                if (account) {
                    balance = { remain: account.remain, total: account.total, unit: account.unit,
                        ...(account.plan ? { plan: account.plan } : {}), usedAtFetch: sessionUsed };
                    this.balances.set(sessionId, balance);
                }
            }
            if (!balance)
                return { enabled: true, sessionUsed };
            return {
                enabled: true, sessionUsed,
                accountRemain: projectRemain(balance, sessionUsed),
                accountTotal: balance.total, unit: balance.unit,
                ...(balance.plan ? { plan: balance.plan } : {}),
            };
        }
        /**
         * Models advertised by the current catalog (base capacities, before overrides)
         * plus the saved per-model context-window overrides. Powers the component
         * settings card; available in both sign-in and API-key modes.
         */
        async contexts() {
            return {
                models: this.options.models().map(model => ({
                    id: model.id,
                    name: model.name ?? model.id,
                    ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
                })),
                overrides: this.options.contexts.all(),
            };
        }
        /**
         * Save one model's context-window override. `tokens <= 0` clears it so the
         * model's own window applies. The next request's resolved model metadata reads
         * the override, which is what DSH's compaction budget uses.
         */
        async setContext(modelId, tokens) {
            this.options.contexts.set(modelId, normalizeContextWindow(tokens));
            void this.options.contexts.persist();
            this.ctx.emit('llm/adapters-updated');
            return { ok: true };
        }
    };
})();
export { WorkBuddyController };
//# sourceMappingURL=controller.js.map