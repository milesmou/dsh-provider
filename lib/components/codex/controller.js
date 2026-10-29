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
import { Action } from './remote.js';
import { modelDirectory } from '../../model-management.js';
let CodexController = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _models_decorators;
    let _quota_decorators;
    let _command_decorators;
    return class CodexController extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _models_decorators = [Remote];
            _quota_decorators = [Remote];
            _command_decorators = [Remote];
            __esDecorate(this, null, _models_decorators, { kind: "method", name: "models", static: false, private: false, access: { has: obj => "models" in obj, get: obj => obj.models }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _quota_decorators, { kind: "method", name: "quota", static: false, private: false, access: { has: obj => "quota" in obj, get: obj => obj.quota }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _command_decorators, { kind: "method", name: "command", static: false, private: false, access: { has: obj => "command" in obj, get: obj => obj.command }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        options = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, options) {
            super(ctx, 'codexProvider');
            this.options = options;
        }
        async models(refresh) {
            if (typeof refresh !== 'boolean')
                throw new TypeError('Invalid model refresh');
            if (refresh)
                await this.options.catalog.refresh();
            else
                await this.options.catalog.ready();
            return modelDirectory(this.options.catalog.models(), this.options.catalog.issue);
        }
        async quota(refresh) {
            if (typeof refresh !== 'boolean')
                throw new TypeError('Invalid quota refresh');
            return this.options.quota.read(refresh);
        }
        async command(action) {
            Action.parse(action);
            const { session, catalog } = this.options;
            if (action === 'refresh')
                await catalog.refresh();
            const status = await session.status();
            return { ...status, models: catalog.models().length, source: catalog.source, issue: status.issue ?? catalog.issue };
        }
    };
})();
export { CodexController };
//# sourceMappingURL=controller.js.map