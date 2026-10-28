window.__ModuleLoader__.load({id:"dsh-codebuddy-provider",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
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
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/card.tsx
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: 0, opacity: 0.7, fontSize: 12, lineHeight: 1.6 }, children: "\u5BC6\u94A5\u4FDD\u5B58\u5728 DSH \u7684\u51ED\u636E\u5B58\u50A8\u4E2D\u3002\u4FDD\u5B58\u540E\uFF0C\u5728\u5BF9\u8BDD\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u9009\u62E9 CodeBuddy API\u3002" }),
    status?.writable === false ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "note", style: { margin: 0, fontSize: 12 }, children: "\u5F53\u524D\u5BC6\u94A5\u6765\u6E90\u4E0D\u53EF\u5199\uFF1B\u82E5\u7531\u542F\u52A8\u73AF\u5883\u53D8\u91CF\u63D0\u4F9B\uFF0C\u8BF7\u5148\u79FB\u9664\u8BE5\u53D8\u91CF\u5E76\u91CD\u542F DSH\u3002" }) : null,
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

// src/client/index.tsx
var NS = "llm-codebuddy-provider";
var name = "codebuddy-provider-settings";
var inject = ["slots", "remote", "remote.credentials", "remote.settings"];
function apply(ctx) {
  async function reference() {
    const result = await ctx.remote.settings.describe();
    if (!result.ok) throw new Error("Settings unavailable");
    const section = result.value.namespaces.find((entry) => entry.ns === NS);
    const value = section?.value;
    if (typeof value?.apiKeyEnv !== "string") throw new Error("CodeBuddy settings unavailable");
    return value.apiKeyEnv;
  }
  const actions = {
    status: async () => {
      const ref = await reference();
      const response = await ctx.remote.credentials.describe([ref]);
      if (!response.ok || !response.value[ref]) throw new Error("Credential state unavailable");
      const info = response.value[ref];
      return { configured: info.configured, writable: info.writable };
    },
    save: async (value) => {
      const trimmed = value.trim();
      if (!trimmed || /[^\x21-\x7e]/.test(trimmed)) throw new Error("Invalid credential");
      const response = await ctx.remote.credentials.set(await reference(), trimmed);
      if (!response.ok) throw new Error("Credential write refused");
    }
  };
  ctx.slots.inject("settings.models.footer", () => ctx.slots.register({
    name: "settings.models.footer",
    id: "codebuddy-api-key",
    order: 20,
    inject: () => ({ actions })
  }, CodeBuddyKeyCard));
}
return module.exports;}});
