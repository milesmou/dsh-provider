window.__ModuleLoader__.load({id:"dsh-provider",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name6 in all)
    __defProp(target, name6, { get: all[name6], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply5,
  inject: () => inject5,
  name: () => name5
});
module.exports = __toCommonJS(index_exports);

// src/components/workbuddy/remote.ts
var import_zod2 = require("zod");

// node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/remote-info.js
function createTypertRemoteInfo(spec, zod) {
  return new RemoteInfo(spec, zod);
}
var RemoteInfo = class {
  spec;
  zod;
  index;
  constructor(spec, zod) {
    this.spec = spec;
    this.zod = zod;
  }
  get package() {
    return this.spec.package;
  }
  get descriptors() {
    return this.resolve().descriptors;
  }
  get methods() {
    return this.resolve().methods;
  }
  resolve() {
    if (this.index !== void 0)
      return this.index;
    const zod = this.zod;
    const descriptors = [];
    const methods = /* @__PURE__ */ Object.create(null);
    for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
      const separator = endpoint.indexOf("/");
      const namespace = endpoint.slice(0, separator);
      const method = endpoint.slice(separator + 1);
      const parameters = definition.parameters.map((parameter) => ({ ...parameter, wire: parameter.wire ?? parameter.name }));
      const descriptor = {
        ...definition,
        id: `${this.spec.package}#${endpoint}`,
        namespace,
        method,
        parameters,
        result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
      };
      if (definition.invocation.kind === "direct") {
        const inputs = [];
        const direct = Object.assign(descriptor, {
          input(options) {
            const strict = options?.strict === true;
            return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
          },
          invoke(remote, input, signal) {
            const named = input;
            const values = parameters.map((parameter) => named[parameter.wire]);
            if (definition.cancellation !== void 0)
              values.push(signal);
            const receiver = Reflect.get(remote, namespace);
            const call = Reflect.get(receiver, method);
            return call.apply(receiver, values);
          }
        });
        methods[endpoint] = direct;
      }
      descriptors.push(descriptor);
    }
    return this.index = { descriptors, methods };
  }
};
function optional(parameter) {
  return parameter.source === "json" && parameter.acceptsUndefined === true;
}
var NamedInput = class {
  parameters;
  strict;
  zod;
  schema;
  projection;
  constructor(parameters, strict, zod) {
    this.parameters = parameters;
    this.strict = strict;
    this.zod = zod;
  }
  codec(parameter) {
    return this.strict ? parameter.strictCodec : parameter.codec;
  }
  create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
    const value = this.codec(parameter).create();
    return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
  })));
  get jsonSchema() {
    return this.project().jsonSchema;
  }
  get jsonSchemaError() {
    return this.project().jsonSchemaError;
  }
  project() {
    if (this.projection !== void 0)
      return this.projection;
    const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
    if (unavailable !== void 0) {
      return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
    }
    return this.projection = {
      jsonSchema: {
        type: "object",
        properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
          ...this.codec(parameter).jsonSchema,
          ...parameter.description === void 0 ? {} : { description: parameter.description }
        }])),
        required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
        additionalProperties: false
      }
    };
  }
};
var ResultValue = class {
  spec;
  projection;
  constructor(spec) {
    this.spec = spec;
  }
  get mode() {
    return this.spec.mode;
  }
  get typeSymbol() {
    return this.spec.typeSymbol;
  }
  get create() {
    return this.spec.create;
  }
  get decode() {
    return this.spec.decode;
  }
  get encode() {
    return this.spec.encode;
  }
  get description() {
    return this.spec.description;
  }
  get jsonSchemaError() {
    return this.spec.jsonSchemaError;
  }
  get jsonSchema() {
    if (this.projection === void 0) {
      const schema = this.spec.jsonSchema;
      this.projection = { value: schema === void 0 ? void 0 : { ...schema, description: this.spec.description } };
    }
    return this.projection.value;
  }
};

// src/model-management.ts
var import_zod = require("zod");
var ModelDirectory = import_zod.z.object({
  models: import_zod.z.array(import_zod.z.object({ id: import_zod.z.string(), name: import_zod.z.string(), contextWindow: import_zod.z.number().positive().optional() })),
  issue: import_zod.z.string().optional()
});

// src/components/workbuddy/remote.ts
var Action = import_zod2.z.enum(["status", "login", "poll", "cancel", "desktop"]);
var Reply = import_zod2.z.object({
  configured: import_zod2.z.boolean().optional(),
  source: import_zod2.z.enum(["desktop", "browser"]).optional(),
  issue: import_zod2.z.string().optional(),
  url: import_zod2.z.string().optional(),
  pending: import_zod2.z.boolean().optional()
});
var Credits = import_zod2.z.object({
  enabled: import_zod2.z.boolean(),
  sessionUsed: import_zod2.z.number().optional(),
  accountRemain: import_zod2.z.number().optional(),
  accountTotal: import_zod2.z.number().optional(),
  unit: import_zod2.z.string().optional(),
  plan: import_zod2.z.string().optional(),
  mode: import_zod2.z.enum(["api", "workbuddy"]).optional(),
  updatedAt: import_zod2.z.number().optional(),
  stale: import_zod2.z.boolean().optional(),
  issue: import_zod2.z.string().optional()
});
var TurnCredits = import_zod2.z.object({ tracked: import_zod2.z.boolean(), used: import_zod2.z.number().nonnegative().optional(), partial: import_zod2.z.boolean().optional() });
var codec = (schema, name6) => ({
  mode: "strict",
  typeSymbol: "dsh-provider#workbuddy:" + name6,
  create: () => schema,
  jsonSchema: import_zod2.z.toJSONSchema(schema)
});
var actionCodec = codec(Action, "action");
var sessionIdCodec = codec(import_zod2.z.string(), "sessionId");
var refreshCodec = codec(import_zod2.z.boolean(), "refresh");
var turnCodec = codec(import_zod2.z.number().int().nonnegative(), "turn");
var REMOTE = createTypertRemoteInfo({ package: "dsh-provider", methods: {
  "workbuddyProvider/models": {
    service: "workbuddyProvider",
    invocation: { kind: "direct" },
    parameters: [{ name: "refresh", source: "json", codec: refreshCodec, strictCodec: refreshCodec }],
    result: codec(ModelDirectory, "models")
  },
  "workbuddyProvider/command": {
    service: "workbuddyProvider",
    invocation: { kind: "direct" },
    parameters: [{ name: "action", source: "json", codec: actionCodec, strictCodec: actionCodec }],
    result: codec(Reply, "reply")
  },
  "workbuddyProvider/credits": {
    service: "workbuddyProvider",
    invocation: { kind: "direct" },
    parameters: [
      { name: "sessionId", source: "json", codec: sessionIdCodec, strictCodec: sessionIdCodec },
      { name: "refresh", source: "json", codec: refreshCodec, strictCodec: refreshCodec }
    ],
    result: codec(Credits, "credits")
  },
  "workbuddyProvider/turnCredits": {
    service: "workbuddyProvider",
    invocation: { kind: "direct" },
    parameters: [
      { name: "sessionId", source: "json", codec: sessionIdCodec, strictCodec: sessionIdCodec },
      { name: "turn", source: "json", codec: turnCodec, strictCodec: turnCodec }
    ],
    result: codec(TurnCredits, "turnCredits")
  }
} }, import_zod2.z);

// src/components/codex/remote.ts
var import_zod3 = require("zod");
var Action2 = import_zod3.z.enum(["status", "refresh"]);
var Reply2 = import_zod3.z.object({ configured: import_zod3.z.boolean(), models: import_zod3.z.number(), source: import_zod3.z.enum(["cache", "live"]).optional(), issue: import_zod3.z.string().optional() });
var QuotaReply = import_zod3.z.object({
  available: import_zod3.z.boolean(),
  windows: import_zod3.z.array(import_zod3.z.object({
    kind: import_zod3.z.enum(["primary", "secondary"]),
    usedPercent: import_zod3.z.number().min(0).max(100),
    windowDurationMins: import_zod3.z.number().positive().optional(),
    resetsAt: import_zod3.z.number().nonnegative().optional()
  })),
  updatedAt: import_zod3.z.number().optional(),
  plan: import_zod3.z.string().optional(),
  stale: import_zod3.z.boolean().optional(),
  issue: import_zod3.z.string().optional()
});
var codec2 = (schema, name6) => ({
  mode: "strict",
  typeSymbol: "dsh-provider#codex:" + name6,
  create: () => schema,
  jsonSchema: import_zod3.z.toJSONSchema(schema)
});
var actionCodec2 = codec2(Action2, "action");
var refreshCodec2 = codec2(import_zod3.z.boolean(), "quotaRefresh");
var REMOTE2 = createTypertRemoteInfo({ package: "dsh-provider", methods: {
  "codexProvider/models": {
    service: "codexProvider",
    invocation: { kind: "direct" },
    parameters: [{ name: "refresh", source: "json", codec: refreshCodec2, strictCodec: refreshCodec2 }],
    result: codec2(ModelDirectory, "models")
  },
  "codexProvider/command": {
    service: "codexProvider",
    invocation: { kind: "direct" },
    parameters: [{ name: "action", source: "json", codec: actionCodec2, strictCodec: actionCodec2 }],
    result: codec2(Reply2, "reply")
  },
  "codexProvider/quota": {
    service: "codexProvider",
    invocation: { kind: "direct" },
    parameters: [{ name: "refresh", source: "json", codec: refreshCodec2, strictCodec: refreshCodec2 }],
    result: codec2(QuotaReply, "quota")
  }
} }, import_zod3.z);

// src/remote.ts
var REMOTE3 = {
  package: "dsh-provider",
  get descriptors() {
    return [...REMOTE.descriptors, ...REMOTE2.descriptors];
  }
};

// src/components/workbuddy/client/index.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply2,
  inject: () => inject2,
  name: () => name2
});

// src/client/settings-page.tsx
var settings_page_exports = {};
__export(settings_page_exports, {
  PROVIDER_CARDS_SLOT: () => PROVIDER_CARDS_SLOT,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});

// src/client/settings-nav-icon.ts
var MARKER = "data-dsh-provider-settings-nav";
var PANEL_NAV = '[data-shortcut-modal="settings"] nav';
var PUZZLE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6H5a2 2 0 0 0-2 2v3h1a3 3 0 1 1 0 6H3v3a1 1 0 0 0 1 1h5v-1a3 3 0 1 1 6 0v1h5a1 1 0 0 0 1-1v-5h-1a3 3 0 1 0 0-6h1V8a2 2 0 0 0-2-2h-4V5a3 3 0 1 0-6 0v1Z"/></svg>';
function installSettingsNavIcon(ctx, label2) {
  ctx.effect(() => {
    if (typeof document === "undefined" || !document.body) return () => {
    };
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-provider";
    const mask = `url("data:image/svg+xml,${encodeURIComponent(PUZZLE)}") center / contain no-repeat`;
    style.textContent = `
      ${PANEL_NAV} button[${MARKER}] > svg { display: none; }
      ${PANEL_NAV} button[${MARKER}]::before {
        content: ""; width: 16px; height: 16px; flex: 0 0 16px;
        background-color: currentColor; -webkit-mask: ${mask}; mask: ${mask};
      }
    `;
    document.head.appendChild(style);
    let nav = null;
    const marked = /* @__PURE__ */ new Set();
    const clear = () => {
      for (const button of marked) button.removeAttribute(MARKER);
      marked.clear();
    };
    const update = () => {
      clear();
      for (const button of nav?.querySelectorAll("button") ?? []) {
        if (button.textContent?.trim() !== label2 || button.firstElementChild?.localName !== "svg") continue;
        button.setAttribute(MARKER, "");
        marked.add(button);
      }
    };
    const navObserver = new MutationObserver(update);
    const sync = () => {
      const next = document.querySelector(PANEL_NAV);
      if (next === nav) return;
      navObserver.disconnect();
      clear();
      nav = next;
      if (nav) navObserver.observe(nav, { childList: true, subtree: true, characterData: true });
      update();
    };
    const bodyObserver = new MutationObserver(sync);
    bodyObserver.observe(document.body, { childList: true });
    sync();
    return () => {
      bodyObserver.disconnect();
      navObserver.disconnect();
      clear();
      style.remove();
    };
  });
}

// src/client/settings-page.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var PROVIDER_CARDS_SLOT = "dsh-provider.settings.cards";
var name = "dsh-provider-settings-page";
var inject = ["slots"];
function apply(ctx) {
  installSettingsNavIcon(ctx, "\u6A21\u578B\u6269\u5C55");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "dsh-provider-models",
    order: 11,
    label: "\u6A21\u578B\u6269\u5C55",
    children: { [PROVIDER_CARDS_SLOT]: { kind: "list", scope: "root" } }
  }, ModelExtensionsPage));
}
function ModelExtensionsPage({ renderSlot }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: renderSlot(PROVIDER_CARDS_SLOT, {}) });
}

// src/components/workbuddy/client/provider-card.tsx
var import_react3 = require("react");

// src/components/workbuddy/client/card.tsx
var import_react = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var field = {
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
  borderRadius: 6,
  padding: "9px 12px",
  boxSizing: "border-box"
};
function CodeBuddyKeyCard({ actions }) {
  const [status, setStatus] = (0, import_react.useState)();
  const [draft, setDraft] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [message, setMessage] = (0, import_react.useState)("");
  const [failed, setFailed] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    let live = true;
    void actions.status().then((value) => {
      if (live) setStatus(value);
    }, () => {
      if (live) {
        setMessage("\u8BFB\u53D6\u5BC6\u94A5\u72B6\u6001\u5931\u8D25\uFF0C\u8BF7\u5173\u95ED\u8BBE\u7F6E\u540E\u91CD\u8BD5\u3002");
        setFailed(true);
      }
    });
    return () => {
      live = false;
    };
  }, [actions]);
  async function save() {
    const value = draft.trim();
    if (!value || busy || !status?.writable) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      await actions.save(value);
      setDraft("");
      setStatus(await actions.status());
      setMessage("\u5BC6\u94A5\u5DF2\u4FDD\u5B58\uFF0C\u4E0B\u6B21\u8BF7\u6C42\u7ACB\u5373\u751F\u6548\u3002");
    } catch {
      setFailed(true);
      setMessage("\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u5BC6\u94A5\u683C\u5F0F\u5E76\u91CD\u8BD5\u3002");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { "aria-label": "CodeBuddy API", style: { display: "grid", gap: 10 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: { display: "grid", gap: 6, fontSize: 13 }, children: [
      "API Key",
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "password",
          autoComplete: "new-password",
          spellCheck: false,
          "aria-label": "CodeBuddy API Key",
          style: { ...field, width: "100%" },
          value: draft,
          placeholder: status?.configured ? "\u5DF2\u4FDD\u5B58\uFF1B\u8F93\u5165\u65B0\u5BC6\u94A5\u53EF\u66FF\u6362" : "\u586B\u5199 CodeBuddy \u8BBF\u95EE\u5BC6\u94A5\uFF08ck_\u2026\uFF09",
          disabled: busy || !status?.writable,
          onChange: (event) => {
            setDraft(event.target.value);
            setMessage("");
          }
        }
      )
    ] }),
    status?.writable === false ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "note", style: { margin: 0, fontSize: 12 }, children: "\u5F53\u524D\u51ED\u636E\u5B58\u50A8\u4E0D\u53EF\u5199\uFF0C\u8BF7\u68C0\u67E5 DSH \u7684\u51ED\u636E\u5B58\u50A8\u914D\u7F6E\u3002" }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "button",
      {
        type: "button",
        style: { ...field, cursor: "pointer" },
        disabled: !draft.trim() || busy || !status?.writable,
        onClick: () => {
          void save();
        },
        children: busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u5BC6\u94A5"
      }
    ) }),
    message ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: failed ? "alert" : "status", style: { margin: 0, fontSize: 12 }, children: message }) : null
  ] });
}

// src/client/model-manager.tsx
var import_react2 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
function modelManagementActions(ctx, options) {
  const settings = async () => {
    const result = await ctx.remote.settings.describe();
    if (!result.ok) throw new Error("Model settings unavailable");
    const row2 = result.value.namespaces.find((item) => item.ns === options.namespace);
    if (!row2) throw new Error("Model component unavailable");
    const value = options.path ? object(object(row2.value)[options.path]) : object(row2.value);
    const hiddenModels = Array.isArray(value.hiddenModels) ? value.hiddenModels.filter((id) => typeof id === "string") : [];
    return { ns: row2.ns, revision: row2.revision, hiddenModels, writable: result.value.writable };
  };
  const update = async (transform) => {
    const current = await settings();
    if (!current.writable) throw new Error("Model settings are read-only");
    const hiddenModels = [...new Set(transform(current.hiddenModels))].sort();
    const value = { hiddenModels };
    const patch = options.path ? { [options.path]: value } : value;
    const result = await ctx.remote.settings.update(current.ns, patch, current.revision);
    if (!result.ok) throw new Error("Model settings write refused");
    return hiddenModels;
  };
  return {
    load: async (refresh) => {
      const [state, directory] = await Promise.all([settings(), options.models(refresh)]);
      return { ...directory, hiddenModels: state.hiddenModels, writable: state.writable };
    },
    setHidden: (id, hidden) => update((current) => hidden ? [...current, id] : current.filter((value) => value !== id)),
    showAll: () => update(() => [])
  };
}
var control = {
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
  borderRadius: 6,
  padding: "6px 10px"
};
function contextLabel(value) {
  if (!value) return void 0;
  return value >= 1e6 ? `${Math.round(value / 1e4) / 100}M` : `${Math.round(value / 100) / 10}K`;
}
function ModelManager({ actions, provider }) {
  const [state, setState] = (0, import_react2.useState)();
  const [query, setQuery] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [issue, setIssue] = (0, import_react2.useState)("");
  const generation = (0, import_react2.useRef)(0);
  const load = (0, import_react2.useCallback)(async (refresh) => {
    const current = ++generation.current;
    setBusy(true);
    setIssue("");
    try {
      const next = await actions.load(refresh);
      if (current === generation.current) setState(next);
    } catch {
      if (current === generation.current) setIssue("\u65E0\u6CD5\u8BFB\u53D6\u6A21\u578B\u5217\u8868\uFF0C\u8BF7\u786E\u8BA4\u7EC4\u4EF6\u5DF2\u542F\u7528\u540E\u91CD\u8BD5\u3002");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }, [actions]);
  (0, import_react2.useEffect)(() => {
    setState(void 0);
    void load(false);
    return () => {
      ++generation.current;
    };
  }, [load]);
  async function save(operation) {
    const current = ++generation.current;
    setBusy(true);
    setIssue("");
    try {
      const hiddenModels = await operation();
      if (current === generation.current) setState((previous) => previous ? { ...previous, hiddenModels } : previous);
    } catch {
      if (current === generation.current) setIssue("\u4FDD\u5B58\u6A21\u578B\u663E\u793A\u8BBE\u7F6E\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  const hidden = new Set(state?.hiddenModels ?? []);
  const models = state?.models ?? [];
  const visible = models.filter((model) => !hidden.has(model.id)).length;
  const search = query.trim().toLowerCase();
  const matches = models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(search));
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("details", { "aria-label": `${provider} \u6A21\u578B\u7BA1\u7406`, style: { border: "1px solid color-mix(in srgb, currentColor 18%, transparent)", borderRadius: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("summary", { style: { cursor: "pointer", padding: "10px 12px", fontSize: 13 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u6A21\u578B\u7BA1\u7406" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { marginLeft: 12, opacity: 0.65, fontSize: 12 }, children: state ? `\u663E\u793A ${visible}/${models.length} \xB7 \u5DF2\u9690\u85CF ${models.length - visible}` : busy ? "\u8BFB\u53D6\u4E2D\u2026" : "\u672A\u52A0\u8F7D" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { padding: "0 12px 12px", display: "grid", gap: 10, fontSize: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: { margin: 0, lineHeight: 1.7, opacity: 0.7 }, children: "\u663E\u793A\u8BBE\u7F6E\u81EA\u52A8\u4FDD\u5B58\uFF0C\u9690\u85CF\u7684\u6A21\u578B\u4F1A\u4ECE\u5BF9\u8BDD\u6A21\u578B\u9009\u62E9\u5217\u8868\u4E2D\u79FB\u9664\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "input",
          {
            type: "search",
            "aria-label": `${provider} \u641C\u7D22\u6A21\u578B`,
            placeholder: "\u641C\u7D22\u6A21\u578B\u540D\u79F0\u6216 ID",
            value: query,
            onChange: (event) => setQuery(event.target.value),
            style: { ...control, flex: "1 1 160px", minWidth: 0 }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: control, disabled: busy, onClick: () => {
          void load(true);
        }, children: busy ? "\u5904\u7406\u4E2D\u2026" : "\u5237\u65B0\u5217\u8868" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            style: control,
            disabled: busy || !state?.writable || !state.hiddenModels.length,
            onClick: () => {
              void save(() => actions.showAll());
            },
            children: "\u5168\u90E8\u663E\u793A"
          }
        )
      ] }),
      state && !state.writable ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: { margin: 0 }, children: "\u5F53\u524D\u914D\u7F6E\u53EA\u8BFB\u3002" }) : null,
      state && !visible && models.length ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: { margin: 0 }, children: "\u5168\u90E8\u6A21\u578B\u5DF2\u9690\u85CF\uFF0C\u53EF\u70B9\u51FB\u773C\u775B\u56FE\u6807\u6216\u201C\u5168\u90E8\u663E\u793A\u201D\u6062\u590D\u3002" }) : null,
      matches.length ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { "aria-label": `${provider} \u6A21\u578B\u5217\u8868`, style: { listStyle: "none", margin: 0, padding: 0, maxHeight: 280, overflowY: "auto" }, children: matches.map((model) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 0",
        borderBottom: "1px solid color-mix(in srgb, currentColor 10%, transparent)"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { flex: 1, minWidth: 0, opacity: hidden.has(model.id) ? 0.55 : 1 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontWeight: 500, overflowWrap: "anywhere" }, children: model.name }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { opacity: 0.65, fontSize: 11, overflowWrap: "anywhere" }, children: [
            model.id,
            contextLabel(model.contextWindow) ? ` \xB7 ${contextLabel(model.contextWindow)} \u4E0A\u4E0B\u6587` : ""
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-label": `${provider} \u663E\u793A ${model.name} (${model.id})`,
            "aria-checked": !hidden.has(model.id),
            title: hidden.has(model.id) ? "\u663E\u793A\u6A21\u578B" : "\u9690\u85CF\u6A21\u578B",
            disabled: busy || !state?.writable,
            onClick: () => {
              void save(() => actions.setHidden(model.id, !hidden.has(model.id)));
            },
            style: {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
              width: 28,
              height: 28,
              padding: 4,
              border: 0,
              borderRadius: 4,
              background: "transparent",
              color: "inherit",
              cursor: busy || !state?.writable ? "default" : "pointer",
              opacity: busy || !state?.writable ? 0.35 : hidden.has(model.id) ? 0.55 : 1
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "svg",
              {
                width: "18",
                height: "18",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "1.75",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": "true",
                focusable: "false",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "12", cy: "12", r: "3" }),
                  hidden.has(model.id) ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "m3 3 18 18" }) : null
                ]
              }
            )
          }
        )
      ] }, model.id)) }) : state ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: { margin: 0 }, children: models.length ? "\u6CA1\u6709\u5339\u914D\u7684\u6A21\u578B\u3002" : "\u6682\u65E0\u6A21\u578B\uFF0C\u8BF7\u8FDE\u63A5\u8D26\u53F7\u540E\u5237\u65B0\u5217\u8868\u3002" }) : null,
      issue || state?.issue ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { role: "alert", style: { margin: 0, lineHeight: 1.7 }, children: issue || state?.issue }) : null
    ] })
  ] });
}

// src/components/workbuddy/client/provider-card.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var control2 = {
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
  borderRadius: 6,
  padding: "8px 12px"
};
var selectColors = {
  color: "var(--dsw-alias-label-primary, CanvasText)",
  backgroundColor: "var(--dsw-alias-bg-layer-2, Canvas)"
};
var selectControl = { ...control2, ...selectColors };
var label = { display: "grid", gap: 6, fontSize: 13 };
function WorkBuddyCard({ actions, connection, modelActions }) {
  const [state, setState] = (0, import_react3.useState)();
  const [issue, setIssue] = (0, import_react3.useState)("");
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [url, setURL] = (0, import_react3.useState)("");
  const [polling, setPolling] = (0, import_react3.useState)(false);
  (0, import_react3.useEffect)(() => {
    let live = true;
    void connection.status().then((value) => {
      if (live) setState(value);
    }, () => {
      if (live) setIssue("\u8BFB\u53D6\u63A5\u5165\u8BBE\u7F6E\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u3002");
    });
    return () => {
      live = false;
    };
  }, [connection]);
  (0, import_react3.useEffect)(() => {
    if (!polling) return;
    let live = true;
    let timer;
    const poll = async () => {
      try {
        const result = await connection.control("poll");
        if (!live) return;
        if (result.pending) timer = setTimeout(() => {
          void poll();
        }, 1500);
        else {
          setPolling(false);
          setURL("");
          setIssue(result.issue ?? "");
          setState(await connection.status());
        }
      } catch {
        if (live) {
          setPolling(false);
          setIssue("\u767B\u5F55\u72B6\u6001\u8BFB\u53D6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
        }
      }
    };
    timer = setTimeout(() => {
      void poll();
    }, 1500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [polling, connection]);
  async function select(mode2, region) {
    setBusy(true);
    setIssue("");
    setPolling(false);
    setURL("");
    try {
      await connection.select(mode2, region);
      setState(await connection.status());
    } catch {
      setIssue("\u4FDD\u5B58\u63A5\u5165\u65B9\u5F0F\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    } finally {
      setBusy(false);
    }
  }
  async function command(action) {
    setBusy(true);
    setIssue("");
    try {
      const result = await connection.control(action);
      setIssue(result.issue ?? "");
      if (result.url) {
        setURL(result.url);
        setPolling(true);
      } else {
        setURL("");
        setPolling(false);
        setState(await connection.status());
      }
    } catch {
      setIssue("WorkBuddy \u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    } finally {
      setBusy(false);
    }
  }
  async function startLogin() {
    const popup = window.open("about:blank", "_blank");
    setBusy(true);
    setIssue("");
    try {
      const result = await connection.control("login");
      if (result.url) {
        if (popup && !popup.closed) {
          popup.location.href = result.url;
          try {
            popup.focus();
          } catch {
          }
        }
        setURL(result.url);
        setPolling(true);
        setIssue("");
      } else {
        try {
          popup?.close();
        } catch {
        }
        setURL("");
        setPolling(false);
        setIssue(result.issue ?? "");
        setState(await connection.status());
      }
    } catch {
      try {
        popup?.close();
      } catch {
      }
      setURL("");
      setPolling(false);
      setIssue("WorkBuddy \u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    } finally {
      setBusy(false);
    }
  }
  async function chooseContext(next) {
    setBusy(true);
    setIssue("");
    try {
      await connection.context(next);
      setState(await connection.status());
    } catch {
      setIssue("\u4FDD\u5B58\u4E0A\u4E0B\u6587\u7A97\u53E3\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    } finally {
      setBusy(false);
    }
  }
  const mode = state?.mode ?? "api";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { "aria-label": "WorkBuddy \u8BBE\u7F6E", style: { marginTop: 20, display: "grid", gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "WorkBuddy" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: label, children: [
      "\u63A5\u5165\u65B9\u5F0F ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "select",
        {
          style: selectControl,
          "aria-label": "WorkBuddy \u63A5\u5165\u65B9\u5F0F",
          value: mode,
          disabled: !state?.writable || busy,
          onChange: (event) => {
            void select(event.target.value, state?.region ?? "cn");
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { style: selectColors, value: "api", children: "CodeBuddy API Key" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { style: selectColors, value: "workbuddy", children: "WorkBuddy \u767B\u5F55\uFF08\u514D API Key\uFF09" })
          ]
        }
      )
    ] }),
    mode === "api" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CodeBuddyKeyCard, { actions }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { "aria-label": "WorkBuddy \u767B\u5F55", style: { display: "grid", gap: 10 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: label, children: [
        "WorkBuddy \u7248\u672C ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "select",
          {
            style: selectControl,
            "aria-label": "WorkBuddy \u7248\u672C",
            value: state?.region ?? "cn",
            disabled: !state?.writable || busy || polling,
            onChange: (event) => {
              void select("workbuddy", event.target.value);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { style: selectColors, value: "cn", children: "\u56FD\u5185\u7248" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { style: selectColors, value: "intl", children: "\u56FD\u9645\u7248 WorkBuddy AI" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: state?.login?.configured ? `\u5DF2\u8FDE\u63A5\uFF08${state.login.source === "browser" ? "\u6D4F\u89C8\u5668\u767B\u5F55" : "\u672C\u673A\u767B\u5F55"}\uFF09` : "\u672A\u8FDE\u63A5 WorkBuddy" }),
      state?.login?.issue ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { role: "note", style: { margin: 0, fontSize: 12 }, children: state.login.issue }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { style: control2, type: "button", disabled: busy || polling, onClick: () => {
          void startLogin();
        }, children: "\u6D4F\u89C8\u5668\u767B\u5F55" }),
        polling ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { style: control2, type: "button", disabled: busy, onClick: () => {
          void command("cancel");
        }, children: "\u53D6\u6D88\u767B\u5F55" }) : null
      ] }),
      url ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("a", { href: url, target: "_blank", rel: "noopener noreferrer", children: "\u767B\u5F55\u9875\u9762\u672A\u81EA\u52A8\u6253\u5F00\uFF1F\u70B9\u6B64\u624B\u52A8\u6253\u5F00\uFF0C\u5B8C\u6210\u540E\u5C06\u81EA\u52A8\u8FDE\u63A5" }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: label, children: [
      "\u4E0A\u4E0B\u6587\u7A97\u53E3 ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "select",
        {
          style: selectControl,
          "aria-label": "\u4E0A\u4E0B\u6587\u7A97\u53E3",
          value: state?.context ?? "middle",
          disabled: !state?.writable || busy,
          onChange: (event) => {
            void chooseContext(event.target.value);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { style: selectColors, value: "light", children: "\u8F7B\u91CF" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { style: selectColors, value: "middle", children: "\u5747\u8861" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { style: selectColors, value: "max", children: "\u6700\u5927" })
          ]
        }
      )
    ] }),
    issue ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { role: "alert", style: { margin: 0, fontSize: 12 }, children: issue }) : null,
    modelActions ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      ModelManager,
      {
        actions: modelActions,
        provider: "WorkBuddy"
      },
      `${state?.mode}:${state?.region}:${state?.context}:${state?.login?.configured}`
    ) : null
  ] });
}

// src/components/workbuddy/client/credits-badge.tsx
var import_react4 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var WORKBUDDY_PROVIDER = "workbuddy";
var REFRESH_MS = 5e3;
function fmt(value) {
  if (value === void 0 || !Number.isFinite(value)) return "\u2014";
  return String(Math.round(value * 100) / 100);
}
var wrap = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  flex: "none",
  height: 24,
  padding: "0 8px",
  borderRadius: 6,
  font: "inherit",
  fontSize: 11,
  lineHeight: "16px",
  color: "var(--dsw-alias-label-secondary, CanvasText)",
  background: "color-mix(in srgb, currentColor 8%, transparent)",
  whiteSpace: "nowrap",
  cursor: "default"
};
var refreshButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  margin: 0,
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  lineHeight: 0,
  opacity: 0.7
};
function CreditsBadge({ sessionId, credits, selection }) {
  const [view, setView] = (0, import_react4.useState)();
  const [selected, setSelected] = (0, import_react4.useState)({});
  const provider = selected.sessionId === sessionId ? selected.provider : void 0;
  const selectionRevision = selected.sessionId === sessionId ? selected.revision : void 0;
  const [refreshing, setRefreshing] = (0, import_react4.useState)(false);
  const generation = (0, import_react4.useRef)(0);
  const requestSequence = (0, import_react4.useRef)(0);
  (0, import_react4.useEffect)(() => {
    setSelected({});
    if (!sessionId) return;
    let source;
    try {
      source = selection?.(sessionId);
    } catch {
      source = void 0;
    }
    if (!source) return;
    let live = true;
    const store = source;
    const read = () => {
      if (!live) return;
      let current;
      try {
        current = store.getSnapshot()?.current;
      } catch {
        current = void 0;
      }
      setSelected((previous) => ({ sessionId, provider: current?.provider ?? null, revision: (previous.revision ?? 0) + 1 }));
    };
    read();
    let unsubscribe = () => {
    };
    try {
      unsubscribe = store.subscribe(read);
    } catch {
    }
    return () => {
      live = false;
      unsubscribe();
    };
  }, [sessionId, selection]);
  const readCredits = (0, import_react4.useCallback)(async (force) => {
    if (!sessionId) return;
    const current = generation.current;
    const request = ++requestSequence.current;
    try {
      const next = await credits(sessionId, force);
      if (generation.current === current && requestSequence.current === request) setView(next);
      return next;
    } catch {
      if (generation.current === current && requestSequence.current === request) setView((previous) => ({
        enabled: true,
        mode: previous?.mode,
        issue: "\u79EF\u5206\u8BFB\u53D6\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0\u3002"
      }));
    }
  }, [sessionId, credits]);
  (0, import_react4.useEffect)(() => {
    const current = ++generation.current;
    setView(void 0);
    setRefreshing(false);
    if (!sessionId || provider !== WORKBUDDY_PROVIDER) return;
    let timer;
    const tick = async () => {
      const next = await readCredits(false);
      if (generation.current === current) timer = setTimeout(() => {
        void tick();
      }, next?.mode === "api" ? 6e4 : REFRESH_MS);
    };
    void tick();
    return () => {
      ++generation.current;
      clearTimeout(timer);
    };
  }, [sessionId, readCredits, provider, selectionRevision]);
  const refresh = async () => {
    if (!sessionId || refreshing) return;
    const current = generation.current;
    setRefreshing(true);
    try {
      await readCredits(true);
    } finally {
      if (generation.current === current) setRefreshing(false);
    }
  };
  if (!view?.enabled || provider !== WORKBUDDY_PROVIDER) return null;
  const used = fmt(view.sessionUsed);
  const remain = view.accountRemain === void 0 ? void 0 : fmt(view.accountRemain);
  const title = [
    `\u672C\u4F1A\u8BDD\u6D88\u8017\uFF1A${used} ${view.unit ?? "\u79EF\u5206"}`,
    remain === void 0 ? void 0 : `\u8D26\u53F7\u5269\u4F59\uFF1A${remain} ${view.unit ?? "\u79EF\u5206"}`,
    view.accountTotal === void 0 ? void 0 : `\u603B\u989D\u5EA6\uFF1A${fmt(view.accountTotal)} ${view.unit ?? "\u79EF\u5206"}`,
    view.plan ? `\u5957\u9910\uFF1A${view.plan}` : void 0,
    view.updatedAt === void 0 ? void 0 : `\u66F4\u65B0\u65F6\u95F4\uFF1A${new Date(view.updatedAt).toLocaleString()}`,
    view.issue
  ].filter(Boolean).join("\n");
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { title, style: wrap, "aria-label": view.mode === "api" ? "CodeBuddy API \u79EF\u5206" : "WorkBuddy \u79EF\u5206", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
      "\u672C\u4F1A\u8BDD ",
      used
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { opacity: 0.75 }, children: [
      "\xB7 ",
      remain === void 0 ? "\u5269\u4F59\u4E0D\u53EF\u7528" : `\u5269\u4F59 ${remain}`,
      view.stale ? "\uFF08\u7F13\u5B58\uFF09" : ""
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "button",
      {
        type: "button",
        onClick: (event) => {
          event.stopPropagation();
          void refresh();
        },
        disabled: refreshing,
        "aria-label": "\u5237\u65B0\u4F59\u989D",
        title: "\u5237\u65B0\u4F59\u989D",
        style: { ...refreshButton, opacity: refreshing ? 0.35 : refreshButton.opacity },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M14 8a6 6 0 1 1-1.757-4.243", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M14 2.5V6h-3.5", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" })
        ] })
      }
    )
  ] });
}

// src/components/workbuddy/client/turn-credits.tsx
var import_react5 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
function TurnCreditsBadge({ sessionId, turn, turnCredits }) {
  const number = turn?.turn;
  const closed = turn?.status === "closed";
  const [result, setResult] = (0, import_react5.useState)();
  (0, import_react5.useEffect)(() => {
    let live = true;
    setResult(void 0);
    if (!sessionId || number === void 0 || !closed) return;
    void turnCredits(sessionId, number).then((view2) => {
      if (live) setResult({ sessionId, turn: number, view: view2 });
    }).catch(() => {
      if (live) setResult({ sessionId, turn: number, view: { tracked: false } });
    });
    return () => {
      live = false;
    };
  }, [sessionId, number, closed, turnCredits]);
  if (!closed) return null;
  const view = result && result.sessionId === sessionId && result.turn === number ? result.view : void 0;
  if (!view?.tracked) return null;
  const text = view.used === void 0 ? "\u672C\u8F6E\u79EF\u5206\u4E0D\u53EF\u7528" : view.partial ? `\u672C\u8F6E\u5DF2\u77E5\u6D88\u8017 ${view.used} \u79EF\u5206\uFF08\u90E8\u5206\uFF09` : `\u672C\u8F6E\u6D88\u8017 ${view.used} \u79EF\u5206`;
  const title = view.partial ? "\u90E8\u5206\u8BF7\u6C42\u672A\u8FD4\u56DE\u6709\u6548\u6263\u8D39\u6570\u636E\uFF0C\u65E0\u6CD5\u786E\u8BA4\u672C\u8F6E\u5B8C\u6574\u79EF\u5206\uFF1B\u5DF2\u77E5\u6D88\u8017\u4EC5\u5305\u542B\u670D\u52A1\u7AEF\u8FD4\u56DE\u7684\u5B9E\u9645\u79EF\u5206\u3002" : "\u672C\u8F6E\u6240\u6709 WorkBuddy / CodeBuddy \u6A21\u578B\u8BF7\u6C42\uFF08\u542B\u5DE5\u5177\u8C03\u7528\u540E\u7EED\u8BF7\u6C42\uFF09\u7684\u5B9E\u9645\u79EF\u5206\u4E4B\u548C\u3002";
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "span",
    {
      "aria-label": "\u672C\u8F6E\u79EF\u5206\u6D88\u8017",
      title,
      style: { fontSize: 11, lineHeight: "20px", color: "var(--dsw-alias-label-secondary, CanvasText)" },
      children: text
    }
  );
}

// src/components/workbuddy/credential.ts
var API_KEY_REF = "DSH_PROVIDER_WORKBUDDY_API_KEY";

// src/components/workbuddy/identity.ts
var SETTINGS_NAMESPACE = "dsh-provider";

// src/components/workbuddy/client/index.tsx
var name2 = "workbuddy-component-settings";
var inject2 = ["slots", "remote", "remote.credentials", "remote.settings"];
function apply2(ctx) {
  ctx.inject(["remote.workbuddyProvider"], mountCard);
  ctx.inject(["remote.workbuddyProvider", "modelDirectories"], mountCredits);
  ctx.inject(["remote.workbuddyProvider"], mountTurnCredits);
}
function mountTurnCredits(ctx) {
  const turnCredits = async (sessionId, turn) => {
    const result = await ctx.remote.workbuddyProvider.turnCredits(sessionId, turn);
    if (!result.ok) throw new Error("Turn credits unavailable");
    return result.value;
  };
  const slots = ctx.slots;
  slots.inject("conversation.chat.turnTail", () => slots.register({
    name: "conversation.chat.turnTail",
    id: "workbuddy-turn-credits",
    order: 20,
    inject: () => ({ turnCredits })
  }, TurnCreditsBadge));
}
function mountCredits(ctx) {
  const credits = async (sessionId, refresh = false) => {
    const result = await ctx.remote.workbuddyProvider.credits(sessionId, refresh);
    if (!result.ok) throw new Error("WorkBuddy credits unavailable");
    return result.value;
  };
  const selection = (sessionId) => {
    const directories = ctx.get("modelDirectories");
    if (!directories?.directoryFor) return void 0;
    try {
      return directories.directoryFor(sessionId)?.store;
    } catch {
      return void 0;
    }
  };
  const slots = ctx.slots;
  slots.inject("conversation.session.header.utilities", () => slots.register({
    name: "conversation.session.header.utilities",
    id: "workbuddy-credits",
    order: -20,
    inject: () => ({ credits, selection })
  }, CreditsBadge));
}
function mountCard(ctx) {
  const modelActions = modelManagementActions(ctx, { namespace: SETTINGS_NAMESPACE, path: "workbuddy", models: async (refresh) => {
    const result = await ctx.remote.workbuddyProvider.models(refresh);
    if (!result.ok) throw new Error("WorkBuddy models unavailable");
    return result.value;
  } });
  const section = async () => {
    const response = await ctx.remote.settings.describe();
    if (!response.ok) throw new Error("Settings unavailable");
    const value = response.value.namespaces.find((item) => item.ns === SETTINGS_NAMESPACE);
    if (!value) throw new Error("Provider unavailable");
    return { response: response.value, value };
  };
  const connection = {
    control: async (action) => {
      const result = await ctx.remote.workbuddyProvider.command(action);
      if (!result.ok) throw new Error("WorkBuddy operation unavailable");
      return result.value;
    },
    status: async () => {
      const { response, value } = await section();
      const settings = value.value.workbuddy ?? {};
      const mode = settings.mode === "workbuddy" ? "workbuddy" : "api";
      const region = settings.workbuddyRegion === "intl" ? "intl" : "cn";
      const context = settings.contextWindow === "light" ? "light" : settings.contextWindow === "max" ? "max" : "middle";
      const login = mode === "workbuddy" ? await connection.control("status") : void 0;
      return {
        mode,
        region,
        context,
        writable: response.writable,
        ...login ? { login: { configured: !!login.configured, source: login.source, issue: login.issue } } : {}
      };
    },
    select: async (mode, region) => {
      const { value } = await section();
      const result = await ctx.remote.settings.update(value.ns, { workbuddy: { mode, workbuddyRegion: region } }, value.revision);
      if (!result.ok) throw new Error("Settings write refused");
    },
    context: async (mode) => {
      const { value } = await section();
      const result = await ctx.remote.settings.update(value.ns, { workbuddy: { contextWindow: mode } }, value.revision);
      if (!result.ok) throw new Error("Settings write refused");
    }
  };
  const actions = {
    status: async () => {
      const ref = API_KEY_REF;
      const response = await ctx.remote.credentials.describe([ref]);
      if (!response.ok || !response.value[ref]) throw new Error("Credential state unavailable");
      const info = response.value[ref];
      return { configured: info.configured && info.source === "file", writable: info.writable };
    },
    save: async (value) => {
      const trimmed = value.trim();
      if (!trimmed || /[^\x21-\x7e]/.test(trimmed)) throw new Error("Invalid credential");
      const response = await ctx.remote.credentials.set(API_KEY_REF, trimmed);
      if (!response.ok) throw new Error("Credential write refused");
    }
  };
  ctx.slots.inject(PROVIDER_CARDS_SLOT, () => ctx.slots.register({
    name: PROVIDER_CARDS_SLOT,
    id: "workbuddy",
    order: 20,
    inject: () => ({ actions, connection, modelActions })
  }, WorkBuddyCard));
}

// src/components/codex/client/index.tsx
var client_exports2 = {};
__export(client_exports2, {
  apply: () => apply3,
  inject: () => inject3,
  name: () => name3
});

// src/components/codex/client/card.tsx
var import_react6 = require("react");
var import_jsx_runtime7 = require("react/jsx-runtime");
function CodexCard({ actions, modelActions }) {
  const [status, setStatus] = (0, import_react6.useState)();
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [issue, setIssue] = (0, import_react6.useState)("");
  const [modelRevision, setModelRevision] = (0, import_react6.useState)(0);
  (0, import_react6.useEffect)(() => {
    let live = true;
    void actions.command("status").then((value) => {
      if (live) setStatus(value);
    }, () => {
      if (live) setIssue("\u8BFB\u53D6 Codex \u72B6\u6001\u5931\u8D25\uFF0C\u8BF7\u5173\u95ED\u8BBE\u7F6E\u540E\u91CD\u8BD5\u3002");
    });
    return () => {
      live = false;
    };
  }, [actions]);
  async function refresh() {
    if (busy) return;
    setBusy(true);
    setIssue("");
    try {
      setStatus(await actions.command("refresh"));
      setModelRevision((value) => value + 1);
    } catch {
      setIssue("\u5237\u65B0 Codex \u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { "aria-label": "Codex", style: { borderTop: "1px solid color-mix(in srgb, currentColor 20%, transparent)", marginTop: 24, paddingTop: 20, display: "grid", gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { children: "Codex" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { fontSize: 12, opacity: 0.7 }, children: !status ? "\u8BFB\u53D6\u4E2D\u2026" : status.configured ? "\u5DF2\u8BFB\u53D6\u672C\u673A\u767B\u5F55\u6001" : "\u672A\u767B\u5F55" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { style: { margin: 0, fontSize: 13, lineHeight: 1.7, opacity: 0.8 }, children: [
      "\u4F7F\u7528\u672C\u673A Codex \u767B\u5F55\uFF0C\u65E0\u9700 API Key\u3002",
      !status?.configured ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        "\u8FD0\u884C ",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("code", { children: "codex login" }),
        " \u540E\u5237\u65B0\u3002"
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", disabled: busy, onClick: () => {
      void refresh();
    }, style: {
      font: "inherit",
      color: "inherit",
      background: "transparent",
      border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
      borderRadius: 6,
      padding: "8px 12px",
      cursor: "pointer"
    }, children: busy ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0\u767B\u5F55\u6001\u548C\u6A21\u578B" }) }),
    issue || status?.issue ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { role: "alert", style: { margin: 0, fontSize: 12, lineHeight: 1.7 }, children: issue || status?.issue }) : null,
    modelActions ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ModelManager, { actions: modelActions, provider: "Codex" }, `${status?.configured}:${modelRevision}`) : null
  ] });
}

// src/components/codex/client/quota-badge.tsx
var import_react7 = require("react");

// src/components/codex/client/icon.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function CodexMark({ size = 16 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("svg", { width: size, height: size, viewBox: "0 0 32 32", fill: "none", "aria-hidden": "true", focusable: "false", style: { flex: "none" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("rect", { x: "0.5", y: "0.5", width: "31", height: "31", rx: "8", fill: "#FFFFFF", stroke: "#D9D9DF" }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { transform: "translate(4 4)", d: "M9.20509 8.76514V6.50548C9.20509 6.31517 9.27649 6.17237 9.44293 6.07733L13.9861 3.46091C14.6046 3.10416 15.342 2.93772 16.103 2.93772C18.9573 2.93772 20.7651 5.14986 20.7651 7.50457C20.7651 7.67101 20.7651 7.86132 20.7412 8.05164L16.0316 5.29243C15.7462 5.12599 15.4607 5.12599 15.1753 5.29243L9.20509 8.76514ZM19.8136 17.566V12.1665C19.8136 11.8334 19.6708 11.5955 19.3854 11.4291L13.4152 7.95637L15.3656 6.83836C15.5321 6.74332 15.6749 6.74332 15.8413 6.83836L20.3845 9.45477C21.6928 10.216 22.5728 11.8334 22.5728 13.4032C22.5728 15.2108 21.5025 16.8759 19.8136 17.5657V17.566ZM7.80173 12.8088L5.8513 11.6671C5.68486 11.5721 5.61346 11.4293 5.61346 11.239V6.00616C5.61346 3.46114 7.56389 1.53436 10.2042 1.53436C11.2033 1.53436 12.1307 1.86746 12.9159 2.46205L8.2301 5.17374C7.94475 5.34018 7.80196 5.57801 7.80196 5.91112V12.809L7.80173 12.8088ZM12 15.2349L9.20509 13.6651V10.3352L12 8.76537L14.7947 10.3352V13.6651L12 15.2349ZM13.7958 22.4659C12.7967 22.4659 11.8693 22.1328 11.0841 21.5382L15.7699 18.8265C16.0553 18.6601 16.198 18.4223 16.198 18.0892V11.1912L18.1723 12.3329C18.3388 12.4279 18.4102 12.5707 18.4102 12.7611V17.9939C18.4102 20.5389 16.4359 22.4657 13.7958 22.4657V22.4659ZM8.15848 17.1617L3.61528 14.5453C2.30696 13.784 1.42701 12.1667 1.42701 10.5969C1.42701 8.76537 2.52115 7.12417 4.20987 6.43431V11.8575C4.20987 12.1906 4.35266 12.4284 4.63802 12.5948L10.5846 16.0437L8.63415 17.1617C8.46771 17.2567 8.32492 17.2567 8.15848 17.1617ZM7.897 21.0626C5.20919 21.0626 3.23488 19.0407 3.23488 16.5432C3.23488 16.3529 3.25875 16.1626 3.2824 15.9723L7.96817 18.684C8.25352 18.8504 8.53911 18.8504 8.82447 18.684L14.7947 15.2351V17.4948C14.7947 17.6851 14.7233 17.8279 14.5568 17.9229L10.0136 20.5394C9.39518 20.8961 8.6578 21.0626 7.89677 21.0626H7.897ZM13.7958 23.8929C16.6739 23.8929 19.0762 21.8475 19.6235 19.1358C22.2874 18.4459 24 15.9484 24 13.4034C24 11.7383 23.2865 10.121 22.002 8.95546C22.121 8.45591 22.1924 7.95637 22.1924 7.45705C22.1924 4.05573 19.4331 1.51048 16.2458 1.51048C15.6037 1.51048 14.9852 1.60553 14.3668 1.81971C13.2963 0.773101 11.8215 0.107117 10.2042 0.107117C7.32606 0.107117 4.92383 2.15259 4.37653 4.86428C1.7126 5.55414 0 8.05164 0 10.5967C0 12.2617 0.713506 13.8791 1.99795 15.0446C1.87904 15.5441 1.80764 16.0437 1.80764 16.543C1.80764 19.9443 4.56685 22.4896 7.75421 22.4896C8.39632 22.4896 9.01478 22.3945 9.63324 22.1803C10.7035 23.2269 12.1783 23.8929 13.7958 23.8929Z", fill: "#343541" })
  ] });
}

// src/components/codex/client/quota-badge.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
function windowLabel(window2) {
  const mins = window2.windowDurationMins;
  if (mins === 10080) return "\u5468";
  if (mins === void 0) return window2.kind === "primary" ? "\u4E3B\u989D\u5EA6" : "\u6B21\u989D\u5EA6";
  if (mins % 1440 === 0) return `${mins / 1440}\u5929`;
  if (mins % 60 === 0) return `${mins / 60}h`;
  return `${mins}\u5206\u949F`;
}
function remaining(used) {
  return `${Math.round((100 - used) * 10) / 10}%`;
}
function QuotaBadge({ sessionId, read, selection }) {
  const [selected, setSelected] = (0, import_react7.useState)({});
  const provider = selected.sessionId === sessionId ? selected.provider : void 0;
  const [view, setView] = (0, import_react7.useState)();
  const [busy, setBusy] = (0, import_react7.useState)(false);
  const generation = (0, import_react7.useRef)(0);
  (0, import_react7.useEffect)(() => {
    setSelected({});
    if (!sessionId) return;
    let source;
    try {
      source = selection(sessionId);
    } catch {
      return;
    }
    if (!source) return;
    let live = true;
    const update = () => {
      if (!live) return;
      try {
        setSelected({ sessionId, provider: source.getSnapshot()?.current?.provider });
      } catch {
        setSelected({ sessionId });
      }
    };
    update();
    let unsubscribe = () => {
    };
    try {
      unsubscribe = source.subscribe(update);
    } catch {
      setSelected({ sessionId });
    }
    return () => {
      live = false;
      unsubscribe();
    };
  }, [sessionId, selection]);
  const refresh = (0, import_react7.useCallback)(async (force) => {
    const current = generation.current;
    setBusy(true);
    try {
      const next = await read(force);
      if (generation.current === current) setView(next);
    } catch {
      if (generation.current === current) setView({ available: false, windows: [], issue: "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6 Codex \u989D\u5EA6\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0\u3002" });
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }, [read]);
  (0, import_react7.useEffect)(() => {
    const current = ++generation.current;
    setView(void 0);
    setBusy(false);
    if (!sessionId || provider !== "codex") return;
    let timer;
    const tick = async () => {
      await refresh(false);
      if (generation.current === current) timer = setTimeout(() => {
        void tick();
      }, 6e4);
    };
    void tick();
    return () => {
      ++generation.current;
      clearTimeout(timer);
    };
  }, [sessionId, provider, refresh]);
  if (!sessionId || provider !== "codex") return null;
  const summary = view?.available ? view.windows.map((window2) => `${windowLabel(window2)} ${remaining(window2.usedPercent)}`).join(" \xB7 ") : view ? "\u989D\u5EA6\u4E0D\u53EF\u7528" : "\u8BFB\u53D6\u989D\u5EA6\u2026";
  const details = [
    "Codex \u8D26\u53F7\u5171\u4EAB\u989D\u5EA6",
    ...view?.windows.map((window2) => {
      const reset = window2.resetsAt === void 0 ? "" : `\uFF0C\u91CD\u7F6E\uFF1A${new Date(window2.resetsAt * 1e3).toLocaleString()}`;
      return `${windowLabel(window2)}\u5269\u4F59 ${remaining(window2.usedPercent)}${reset}`;
    }) ?? [],
    view?.plan ? `\u5957\u9910\uFF1A${view.plan}` : void 0,
    view?.updatedAt ? `\u66F4\u65B0\u65F6\u95F4\uFF1A${new Date(view.updatedAt).toLocaleString()}` : void 0,
    view?.issue,
    "\u70B9\u51FB\u5237\u65B0\u989D\u5EA6"
  ].filter(Boolean).join("\n");
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "button",
    {
      type: "button",
      "aria-label": "Codex \u5269\u4F59\u989D\u5EA6",
      "aria-busy": busy,
      title: details,
      disabled: busy,
      onClick: (event) => {
        event.stopPropagation();
        void refresh(true);
      },
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flex: "none",
        height: 26,
        padding: "0 8px",
        border: "none",
        borderRadius: 6,
        font: "inherit",
        fontSize: 11,
        color: "var(--dsw-alias-label-secondary, CanvasText)",
        background: "color-mix(in srgb, currentColor 8%, transparent)",
        whiteSpace: "nowrap",
        cursor: busy ? "default" : "pointer"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CodexMark, { size: 16 }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { children: [
          summary,
          view?.stale ? "\uFF08\u7F13\u5B58\uFF09" : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("svg", { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: { opacity: 0.65 }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M14 8a6 6 0 1 1-1.757-4.243M14 2.5V6h-3.5", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }) })
      ]
    }
  );
}

// src/client/session-selection.ts
function sessionSelection(ctx, sessionId) {
  const directories = ctx.get("modelDirectories");
  try {
    return directories?.directoryFor(sessionId)?.store;
  } catch {
    return void 0;
  }
}

// src/components/codex/client/index.tsx
var name3 = "codex-component-settings";
var inject3 = ["slots", "remote"];
function apply3(ctx) {
  ctx.inject(["remote.codexProvider", "remote.settings"], (child) => {
    const modelActions = modelManagementActions(child, { namespace: "dsh-provider-codex", models: async (refresh) => {
      const result = await child.remote.codexProvider.models(refresh);
      if (!result.ok) throw new Error("Codex models unavailable");
      return result.value;
    } });
    const actions = { command: async (action) => {
      const result = await child.remote.codexProvider.command(action);
      if (!result.ok) throw new Error("Codex operation unavailable");
      return result.value;
    } };
    child.slots.inject(PROVIDER_CARDS_SLOT, () => child.slots.register({
      name: PROVIDER_CARDS_SLOT,
      id: "codex",
      order: 30,
      inject: () => ({ actions, modelActions })
    }, CodexCard));
  });
  ctx.inject(["remote.codexProvider", "modelDirectories"], (child) => {
    const read = async (refresh) => {
      const result = await child.remote.codexProvider.quota(refresh);
      if (!result.ok) throw new Error("Codex quota unavailable");
      return result.value;
    };
    const slots = child.slots;
    slots.inject("conversation.session.header.utilities", () => slots.register({
      name: "conversation.session.header.utilities",
      id: "codex-quota",
      order: -20,
      inject: () => ({ read, selection: (sessionId) => sessionSelection(child, sessionId) })
    }, QuotaBadge));
  });
}

// src/client/model-label.tsx
var model_label_exports = {};
__export(model_label_exports, {
  apply: () => apply4,
  inject: () => inject4,
  name: () => name4
});

// src/components/workbuddy/client/model-label.tsx
var import_react8 = require("react");
var import_jsx_runtime10 = require("react/jsx-runtime");
var row = { display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 };
var badge = {
  flex: "none",
  fontSize: 10,
  lineHeight: "15px",
  padding: "0 4px",
  borderRadius: 4,
  color: "var(--dsw-alias-label-tertiary, GrayText)",
  background: "color-mix(in srgb, currentColor 10%, transparent)",
  fontVariantNumeric: "tabular-nums"
};
var MULTIPLIER = /^x\d+(?:\.\d+)?$/;
var MARK_PATH = "M30.5931 3.12762C30.9853 2.77585 31.0091 2.76226 31.2968 2.74499C31.7628 2.71097 32.1894 2.93488 32.916 3.59634C34.6132 5.13875 36.9769 8.30904 38.4462 11.0168L39.0138 12.0682L39.8156 12.4668C40.5896 12.8579 41.8593 13.6593 42.3898 14.0895C42.6297 14.2878 42.6638 14.2925 42.9133 14.1954C44.0388 13.7572 45.6506 14.3382 47.0727 15.7024C48.3529 16.9294 49.5794 19.026 50.0491 20.7757C50.1177 21.0574 50.2087 21.6628 50.2419 22.1134C50.349 23.6964 49.8414 24.9608 48.8637 25.5331C48.664 25.6484 48.6505 25.6795 48.6561 26.1774C48.7011 28.5481 48.0621 30.9144 46.7785 33.2221C45.3293 35.8133 42.7489 38.4945 39.2566 41.0199C37.3813 42.3846 32.9445 44.9701 30.9382 45.8778C26.1324 48.0414 22.2794 48.8709 18.9329 48.4609C16.9368 48.219 14.6769 47.44 13.34 46.5355C12.9885 46.2925 12.9325 46.2774 12.6637 46.3543C11.2327 46.7651 9.35867 45.9207 7.76659 44.1535C7.13165 43.4471 6.1065 41.7127 5.77404 40.7843C5.0054 38.6118 5.15852 36.6506 6.18236 35.4799C6.44671 35.1785 6.45511 35.1658 6.39735 34.6589C6.30195 33.8289 6.25837 32.6008 6.30192 31.808L6.33666 31.0674L5.22502 29.101C3.5033 26.0375 2.40933 23.4645 1.98744 21.4992C1.76478 20.4218 1.77881 19.9436 2.05222 19.5899C2.21871 19.3763 2.76493 19.1545 3.42322 19.0329C5.08041 18.742 8.69466 19.0056 12.7155 19.7155L13.1329 19.788L14.0511 18.976C15.5747 17.6264 16.587 16.8696 18.4531 15.706C20.3981 14.4891 22.5929 13.4877 25.0648 12.695L25.8577 12.4414L26.2939 11.2964C27.8547 7.17615 29.4533 4.13844 30.5931 3.12762ZM17.5182 24.243C15.7542 25.2615 14.8718 25.7706 14.2236 26.3413C11.5989 28.6526 10.6181 32.3134 11.7354 35.6274C12.0114 36.4457 12.5201 37.3283 13.5386 39.0923C14.5571 40.8564 15.0671 41.7383 15.6378 42.3864C17.9491 45.0112 21.6103 45.9929 24.9243 44.8755C25.7426 44.5995 26.6249 44.0899 28.3888 43.0714L38.5375 37.2121C40.3016 36.1936 41.184 35.6845 41.8321 35.1137C44.4568 32.8024 45.4373 29.1409 44.3198 25.8269C44.0438 25.0086 43.5342 24.1264 42.5158 22.3624C41.4973 20.5983 40.9882 19.7159 40.4175 19.0678C38.1062 16.4432 34.4454 15.4622 31.1314 16.5796C30.3131 16.8556 29.431 17.3651 27.6669 18.3836L17.5182 24.243Z";
function WorkBuddyMark({ size = 16 }) {
  const uid = (0, import_react8.useId)().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `wbBg${uid}`;
  const fg = `wbFg${uid}`;
  const clip = `wbClip${uid}`;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("svg", { width: size, height: size, viewBox: "0 0 40 40", fill: "none", "aria-hidden": "true", style: { flex: "none" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("defs", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("linearGradient", { id: bg, x1: "20", y1: "0", x2: "20", y2: "40", gradientUnits: "userSpaceOnUse", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("stop", { stopColor: "#0EC8A9" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("stop", { offset: "1", stopColor: "#01C886" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("linearGradient", { id: fg, x1: "16.6642", y1: "11.0783", x2: "35.3762", y2: "43.4885", gradientUnits: "userSpaceOnUse", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("stop", { stopColor: "#FFFFFF", stopOpacity: "0.8" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("stop", { offset: "0.437689", stopColor: "#FFFFFF" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("clipPath", { id: clip, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("rect", { width: "40", height: "40", rx: "8.63158" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("g", { clipPath: `url(#${clip})`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("rect", { width: "40", height: "40", rx: "8.63158", fill: `url(#${bg})` }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { fillRule: "evenodd", clipRule: "evenodd", d: MARK_PATH, fill: `url(#${fg})` }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("rect", { x: "18.4961", y: "31.3344", width: "4.00904", height: "8.32646", rx: "2.00452", transform: "rotate(-30 18.4961 31.3344)", fill: "#FFFFFF" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("rect", { x: "29.3125", y: "25.0894", width: "4.00904", height: "8.32646", rx: "2.00452", transform: "rotate(-30 29.3125 25.0894)", fill: "#FFFFFF" })
    ] })
  ] });
}
function ModelNameLabel({ provider, model }) {
  const name6 = model?.name ?? model?.id ?? "";
  if (provider?.id !== WORKBUDDY_PROVIDER) return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: row, children: name6 });
  const multiplier = model?.description && MULTIPLIER.test(model.description) ? model.description : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { style: row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(WorkBuddyMark, {}),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: name6 }),
    multiplier ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: badge, title: `\u79EF\u5206\u500D\u7387 ${multiplier}`, children: multiplier }) : null
  ] });
}

// src/client/model-label.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var name4 = "dsh-provider-model-label";
var inject4 = ["slots"];
function apply4(ctx) {
  const slots = ctx.slots;
  slots.inject("conversation.input.model.label", () => slots.register({
    name: "conversation.input.model.label",
    priority: -20
  }, ModelNameLabel2));
}
function ModelNameLabel2(props) {
  if (props.provider?.id !== "codex") return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ModelNameLabel, { ...props });
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(CodexMark, {}),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: props.model?.name ?? props.model?.id ?? "" })
  ] });
}

// src/client/index.tsx
var name5 = "dsh-provider-settings";
var inject5 = ["remote"];
async function apply5(ctx) {
  const dispose = await ctx.remote.$mount(REMOTE3);
  ctx.effect(() => dispose);
  ctx.plugin(settings_page_exports);
  ctx.plugin(model_label_exports);
  ctx.plugin(client_exports);
  ctx.plugin(client_exports2);
}
return module.exports;}});
