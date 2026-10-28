window.__ModuleLoader__.load({id:"dsh-provider",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name3 in all)
    __defProp(target, name3, { get: all[name3], enumerable: true });
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
  apply: () => apply2,
  name: () => name2
});
module.exports = __toCommonJS(index_exports);

// src/components/workbuddy/client/index.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});

// src/components/workbuddy/client/provider-card.tsx
var import_react2 = require("react");

// src/components/workbuddy/client/card.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": "CodeBuddy API", style: { borderTop: field.border, paddingTop: 20, marginTop: 20, display: "grid", gap: 10 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "CodeBuddy API" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, opacity: 0.7 }, children: status === void 0 ? "\u8BFB\u53D6\u4E2D\u2026" : status.configured ? "\u5DF2\u914D\u7F6E\u5BC6\u94A5" : "\u672A\u914D\u7F6E\u5BC6\u94A5" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "grid", gap: 6, fontSize: 13 }, children: [
      "API Key",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: 0, opacity: 0.7, fontSize: 12, lineHeight: 1.6 }, children: "\u5BC6\u94A5\u4FDD\u5B58\u5728 DSH \u7684\u51ED\u636E\u5B58\u50A8\u4E2D\u3002\u4FDD\u5B58\u540E\uFF0C\u5728\u5BF9\u8BDD\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u9009\u62E9 CodeBuddy API\u3002 \u63D2\u4EF6\u542F\u52A8\u65F6\u81EA\u52A8\u83B7\u53D6\u6A21\u578B\u5217\u8868\uFF1B\u9996\u6B21\u4FDD\u5B58\u6216\u66F4\u6362\u5BC6\u94A5\u540E\u91CD\u65B0\u83B7\u53D6\u3002" }),
    status?.writable === false ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "note", style: { margin: 0, fontSize: 12 }, children: "\u5F53\u524D\u51ED\u636E\u5B58\u50A8\u4E0D\u53EF\u5199\uFF0C\u8BF7\u68C0\u67E5 DSH \u7684\u51ED\u636E\u5B58\u50A8\u914D\u7F6E\u3002" }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
    message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: failed ? "alert" : "status", style: { margin: 0, fontSize: 12 }, children: message }) : null
  ] });
}

// src/components/workbuddy/client/provider-card.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var control = {
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
var selectControl = { ...control, ...selectColors };
var label = { display: "grid", gap: 6, fontSize: 13 };
function WorkBuddyCard({ actions, connection }) {
  const [state, setState] = (0, import_react2.useState)();
  const [issue, setIssue] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [url, setURL] = (0, import_react2.useState)("");
  const [polling, setPolling] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
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
  (0, import_react2.useEffect)(() => {
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
  const mode = state?.mode ?? "api";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { "aria-label": "WorkBuddy \u7EC4\u4EF6\u8BBE\u7F6E", style: { marginTop: 20, display: "grid", gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "WorkBuddy \u7EC4\u4EF6" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: label, children: [
      "\u63A5\u5165\u65B9\u5F0F ",
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { style: selectColors, value: "api", children: "CodeBuddy API Key" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { style: selectColors, value: "workbuddy", children: "WorkBuddy \u767B\u5F55\uFF08\u514D API Key\uFF09" })
          ]
        }
      )
    ] }),
    mode === "api" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CodeBuddyKeyCard, { actions }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { "aria-label": "WorkBuddy \u767B\u5F55", style: { display: "grid", gap: 10 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: label, children: [
        "WorkBuddy \u7248\u672C ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { style: selectColors, value: "cn", children: "\u56FD\u5185\u7248" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { style: selectColors, value: "intl", children: "\u56FD\u9645\u7248 WorkBuddy AI" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: state?.login?.configured ? `\u5DF2\u8FDE\u63A5\uFF08${state.login.source === "browser" ? "\u6D4F\u89C8\u5668\u767B\u5F55" : "\u672C\u673A\u767B\u5F55"}\uFF09` : "\u672A\u8FDE\u63A5 WorkBuddy" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 0, fontSize: 12, opacity: 0.75 }, children: "\u590D\u7528\u672C\u673A\u767B\u5F55\u6001\uFF0C\u5DE5\u5177\u7531 DSH \u6267\u884C\u3002\u82E5\u672C\u673A\u51ED\u636E\u5DF2\u52A0\u5BC6\uFF0C\u8BF7\u4F7F\u7528\u6D4F\u89C8\u5668\u767B\u5F55\u3002\u6A21\u578B\u5217\u8868\u5728\u542F\u52A8\u3001\u5207\u6362\u63A5\u5165\u65B9\u5F0F\u6216\u5B8C\u6210\u767B\u5F55\u65F6\u83B7\u53D6\u3002" }),
      state?.login?.issue ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "note", style: { margin: 0, fontSize: 12 }, children: state.login.issue }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { style: control, type: "button", disabled: busy || polling, onClick: () => {
          void command("login");
        }, children: "\u6D4F\u89C8\u5668\u767B\u5F55" }),
        polling ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { style: control, type: "button", disabled: busy, onClick: () => {
          void command("cancel");
        }, children: "\u53D6\u6D88\u767B\u5F55" }) : null
      ] }),
      url ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: url, target: "_blank", rel: "noopener noreferrer", children: "\u6253\u5F00 WorkBuddy \u767B\u5F55\u9875\u9762\uFF0C\u5B8C\u6210\u540E\u5C06\u81EA\u52A8\u8FDE\u63A5" }) : null
    ] }),
    issue ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", style: { margin: 0, fontSize: 12 }, children: issue }) : null
  ] });
}

// src/components/workbuddy/credential.ts
var API_KEY_REF = "DSH_PROVIDER_WORKBUDDY_API_KEY";

// src/components/workbuddy/remote.ts
var import_zod = require("zod");

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

// src/components/workbuddy/remote.ts
var Action = import_zod.z.enum(["status", "login", "poll", "cancel", "desktop"]);
var Reply = import_zod.z.object({
  configured: import_zod.z.boolean().optional(),
  source: import_zod.z.enum(["desktop", "browser"]).optional(),
  issue: import_zod.z.string().optional(),
  url: import_zod.z.string().optional(),
  pending: import_zod.z.boolean().optional()
});
var codec = (schema, name3) => ({
  mode: "strict",
  typeSymbol: "dsh-provider#workbuddy:" + name3,
  create: () => schema,
  jsonSchema: import_zod.z.toJSONSchema(schema)
});
var actionCodec = codec(Action, "action");
var REMOTE = createTypertRemoteInfo({ package: "dsh-provider", methods: {
  "workbuddyProvider/command": {
    service: "workbuddyProvider",
    invocation: { kind: "direct" },
    parameters: [{ name: "action", source: "json", codec: actionCodec, strictCodec: actionCodec }],
    result: codec(Reply, "reply")
  }
} }, import_zod.z);

// src/components/workbuddy/identity.ts
var SETTINGS_NAMESPACE = "dsh-provider";

// src/components/workbuddy/client/index.tsx
var name = "workbuddy-component-settings";
var inject = ["slots", "remote", "remote.credentials", "remote.settings"];
async function apply(ctx) {
  const dispose = await ctx.remote.$mount(REMOTE);
  ctx.effect(() => dispose);
  ctx.inject(["remote.workbuddyProvider"], mountCard);
}
function mountCard(ctx) {
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
      const login = mode === "workbuddy" ? await connection.control("status") : void 0;
      return {
        mode,
        region,
        writable: response.writable,
        ...login ? { login: { configured: !!login.configured, source: login.source, issue: login.issue } } : {}
      };
    },
    select: async (mode, region) => {
      const { value } = await section();
      const result = await ctx.remote.settings.update(value.ns, { workbuddy: { mode, workbuddyRegion: region } }, value.revision);
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
  ctx.slots.inject("settings.models.footer", () => ctx.slots.register({
    name: "settings.models.footer",
    id: "workbuddy",
    order: 20,
    inject: () => ({ actions, connection })
  }, WorkBuddyCard));
}

// src/client/index.tsx
var name2 = "dsh-provider-settings";
function apply2(ctx) {
  ctx.plugin(client_exports);
}
return module.exports;}});
