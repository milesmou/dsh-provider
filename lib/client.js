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
var hint = { margin: 0, fontSize: 12, opacity: 0.75, lineHeight: 1.6 };
var row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
var WINDOW_200K = 200 * 1024;
var WINDOW_1M = 1024 * 1024;
function formatWindow(tokens) {
  if (tokens === void 0) return "\u672A\u77E5";
  if (tokens >= WINDOW_1M && tokens % WINDOW_1M === 0) return `${tokens / WINDOW_1M}M`;
  if (tokens >= 1024 && tokens % 1024 === 0) return `${tokens / 1024}K`;
  return String(tokens);
}
function ContextWindowRow({ model, value, onSave }) {
  const preset = value === void 0 ? "default" : value === WINDOW_200K ? "200k" : value === WINDOW_1M ? "1m" : "custom";
  const [choice, setChoice] = (0, import_react2.useState)(preset);
  const [custom, setCustom] = (0, import_react2.useState)(preset === "custom" && value !== void 0 ? String(value) : "");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)("");
  (0, import_react2.useEffect)(() => {
    setChoice(preset);
    setCustom(preset === "custom" && value !== void 0 ? String(value) : "");
  }, [preset, value]);
  async function save(tokens) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave(tokens);
    } catch {
      setError("\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    } finally {
      setBusy(false);
    }
  }
  function choose(next) {
    setChoice(next);
    setError("");
    if (next === "default") void save(0);
    else if (next === "200k") void save(WINDOW_200K);
    else if (next === "1m") void save(WINDOW_1M);
  }
  function applyCustom() {
    const tokens = Number(custom.trim());
    if (!Number.isSafeInteger(tokens) || tokens <= 0) {
      setError("\u8BF7\u8F93\u5165\u6B63\u6574\u6570\uFF08\u5355\u4F4D tokens\uFF09");
      return;
    }
    void save(tokens);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "grid", gap: 6 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }, title: model.name, children: model.name }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "select",
        {
          style: selectControl,
          value: choice,
          disabled: busy,
          "aria-label": `${model.name} \u4E0A\u4E0B\u6587\u7A97\u53E3`,
          onChange: (event) => choose(event.target.value),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("option", { style: selectColors, value: "default", children: [
              "\u9ED8\u8BA4\uFF08\u6A21\u578B ",
              formatWindow(model.contextWindow),
              "\uFF09"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { style: selectColors, value: "200k", children: "200K" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { style: selectColors, value: "1m", children: "1M" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { style: selectColors, value: "custom", children: "\u81EA\u5B9A\u4E49\u2026" })
          ]
        }
      )
    ] }),
    choice === "custom" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          style: { ...control, flex: 1, minWidth: 0 },
          inputMode: "numeric",
          placeholder: "\u4F8B\u5982 512000",
          "aria-label": `${model.name} \u81EA\u5B9A\u4E49\u4E0A\u4E0B\u6587\u7A97\u53E3\uFF08tokens\uFF09`,
          value: custom,
          disabled: busy,
          onChange: (event) => {
            setCustom(event.target.value);
            setError("");
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: control, disabled: busy, onClick: applyCustom, children: "\u5E94\u7528" })
    ] }) : null,
    error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", style: { margin: 0, fontSize: 12 }, children: error }) : null
  ] });
}
function ContextWindowSettings({ contexts, setContext }) {
  const [data, setData] = (0, import_react2.useState)();
  const [issue, setIssue] = (0, import_react2.useState)("");
  const load = async () => {
    try {
      setData(await contexts());
      setIssue("");
    } catch {
      setIssue("\u8BFB\u53D6\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u3002");
    }
  };
  (0, import_react2.useEffect)(() => {
    let live = true;
    void contexts().then(
      (value) => {
        if (live) setData(value);
      },
      () => {
        if (live) setIssue("\u8BFB\u53D6\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u3002");
      }
    );
    return () => {
      live = false;
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { "aria-label": "\u4E0A\u4E0B\u6587\u7A97\u53E3", style: {
    borderTop: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
    paddingTop: 16,
    marginTop: 4,
    display: "grid",
    gap: 10
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "\u4E0A\u4E0B\u6587\u7A97\u53E3" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: hint, children: "\u6BCF\u4E2A\u6A21\u578B\u6BCF\u8F6E\u6700\u591A\u643A\u5E26\u7684\u5386\u53F2\u7A97\u53E3\u3002\u7A97\u53E3\u8D8A\u5C0F\uFF0C\u538B\u7F29\u8D8A\u65E9\u3001\u5355\u8F6E\u79EF\u5206\u8D8A\u5C11\uFF1B\u9ED8\u8BA4\u4F7F\u7528\u6A21\u578B\u81EA\u8EAB\u7A97\u53E3\u3002" }),
    data === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: hint, children: "\u8BFB\u53D6\u4E2D\u2026" }) : data.models.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: hint, children: "\u6682\u65E0\u6A21\u578B\uFF1B\u5B8C\u6210\u767B\u5F55\u6216\u4FDD\u5B58\u5BC6\u94A5\u540E\u81EA\u52A8\u83B7\u53D6\u3002" }) : data.models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      ContextWindowRow,
      {
        model,
        value: data.overrides[model.id],
        onSave: async (tokens) => {
          await setContext(model.id, tokens);
          await load();
        }
      },
      model.id
    )),
    issue ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", style: { margin: 0, fontSize: 12 }, children: issue }) : null
  ] });
}
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
          void startLogin();
        }, children: "\u6D4F\u89C8\u5668\u767B\u5F55" }),
        polling ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { style: control, type: "button", disabled: busy, onClick: () => {
          void command("cancel");
        }, children: "\u53D6\u6D88\u767B\u5F55" }) : null
      ] }),
      url ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: url, target: "_blank", rel: "noopener noreferrer", children: "\u767B\u5F55\u9875\u9762\u672A\u81EA\u52A8\u6253\u5F00\uFF1F\u70B9\u6B64\u624B\u52A8\u6253\u5F00\uFF0C\u5B8C\u6210\u540E\u5C06\u81EA\u52A8\u8FDE\u63A5" }) : null
    ] }),
    connection?.contexts && connection?.setContext ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      ContextWindowSettings,
      {
        contexts: connection.contexts,
        setContext: connection.setContext
      },
      `${mode}:${state?.region ?? "cn"}`
    ) : null,
    issue ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", style: { margin: 0, fontSize: 12 }, children: issue }) : null
  ] });
}

// src/components/workbuddy/client/credits-badge.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
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
  const [view, setView] = (0, import_react3.useState)();
  const [provider, setProvider] = (0, import_react3.useState)(void 0);
  const [refreshing, setRefreshing] = (0, import_react3.useState)(false);
  (0, import_react3.useEffect)(() => {
    if (!sessionId) return;
    let source;
    try {
      source = selection?.(sessionId);
    } catch {
      source = void 0;
    }
    if (!source) {
      setProvider(void 0);
      return;
    }
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
      setProvider(current?.provider ?? null);
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
  (0, import_react3.useEffect)(() => {
    if (!sessionId) return;
    let live = true;
    let timer;
    const tick = async () => {
      try {
        const next = await credits(sessionId, false);
        if (live) setView(next);
      } catch {
      } finally {
        if (live) timer = setTimeout(() => {
          void tick();
        }, REFRESH_MS);
      }
    };
    void tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [sessionId, credits]);
  const refresh = async () => {
    if (!sessionId || refreshing) return;
    setRefreshing(true);
    try {
      const next = await credits(sessionId, true);
      setView(next);
    } catch {
    } finally {
      setRefreshing(false);
    }
  };
  if (!view?.enabled) return null;
  if (provider !== void 0 && provider !== null && provider !== WORKBUDDY_PROVIDER) return null;
  const used = fmt(view.sessionUsed ?? 0);
  const remain = view.accountRemain === void 0 ? void 0 : fmt(view.accountRemain);
  const title = [
    `\u672C\u4F1A\u8BDD\u6D88\u8017\uFF1A${used} ${view.unit ?? "\u79EF\u5206"}`,
    remain === void 0 ? void 0 : `\u8D26\u53F7\u5269\u4F59\uFF1A${remain} ${view.unit ?? "\u79EF\u5206"}`,
    view.accountTotal === void 0 ? void 0 : `\u603B\u989D\u5EA6\uFF1A${fmt(view.accountTotal)} ${view.unit ?? "\u79EF\u5206"}`,
    view.plan ? `\u5957\u9910\uFF1A${view.plan}` : void 0
  ].filter(Boolean).join("\n");
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { title, style: wrap, "aria-label": "WorkBuddy \u79EF\u5206", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
      "\u672C\u4F1A\u8BDD ",
      used
    ] }),
    remain === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { opacity: 0.75 }, children: [
      "\xB7 \u5269\u4F59 ",
      remain
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M14 8a6 6 0 1 1-1.757-4.243", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M14 2.5V6h-3.5", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" })
        ] })
      }
    )
  ] });
}

// src/components/workbuddy/client/model-label.tsx
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var row2 = { display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 };
var MARK_PATH = "M30.5931 3.12762C30.9853 2.77585 31.0091 2.76226 31.2968 2.74499C31.7628 2.71097 32.1894 2.93488 32.916 3.59634C34.6132 5.13875 36.9769 8.30904 38.4462 11.0168L39.0138 12.0682L39.8156 12.4668C40.5896 12.8579 41.8593 13.6593 42.3898 14.0895C42.6297 14.2878 42.6638 14.2925 42.9133 14.1954C44.0388 13.7572 45.6506 14.3382 47.0727 15.7024C48.3529 16.9294 49.5794 19.026 50.0491 20.7757C50.1177 21.0574 50.2087 21.6628 50.2419 22.1134C50.349 23.6964 49.8414 24.9608 48.8637 25.5331C48.664 25.6484 48.6505 25.6795 48.6561 26.1774C48.7011 28.5481 48.0621 30.9144 46.7785 33.2221C45.3293 35.8133 42.7489 38.4945 39.2566 41.0199C37.3813 42.3846 32.9445 44.9701 30.9382 45.8778C26.1324 48.0414 22.2794 48.8709 18.9329 48.4609C16.9368 48.219 14.6769 47.44 13.34 46.5355C12.9885 46.2925 12.9325 46.2774 12.6637 46.3543C11.2327 46.7651 9.35867 45.9207 7.76659 44.1535C7.13165 43.4471 6.1065 41.7127 5.77404 40.7843C5.0054 38.6118 5.15852 36.6506 6.18236 35.4799C6.44671 35.1785 6.45511 35.1658 6.39735 34.6589C6.30195 33.8289 6.25837 32.6008 6.30192 31.808L6.33666 31.0674L5.22502 29.101C3.5033 26.0375 2.40933 23.4645 1.98744 21.4992C1.76478 20.4218 1.77881 19.9436 2.05222 19.5899C2.21871 19.3763 2.76493 19.1545 3.42322 19.0329C5.08041 18.742 8.69466 19.0056 12.7155 19.7155L13.1329 19.788L14.0511 18.976C15.5747 17.6264 16.587 16.8696 18.4531 15.706C20.3981 14.4891 22.5929 13.4877 25.0648 12.695L25.8577 12.4414L26.2939 11.2964C27.8547 7.17615 29.4533 4.13844 30.5931 3.12762ZM17.5182 24.243C15.7542 25.2615 14.8718 25.7706 14.2236 26.3413C11.5989 28.6526 10.6181 32.3134 11.7354 35.6274C12.0114 36.4457 12.5201 37.3283 13.5386 39.0923C14.5571 40.8564 15.0671 41.7383 15.6378 42.3864C17.9491 45.0112 21.6103 45.9929 24.9243 44.8755C25.7426 44.5995 26.6249 44.0899 28.3888 43.0714L38.5375 37.2121C40.3016 36.1936 41.184 35.6845 41.8321 35.1137C44.4568 32.8024 45.4373 29.1409 44.3198 25.8269C44.0438 25.0086 43.5342 24.1264 42.5158 22.3624C41.4973 20.5983 40.9882 19.7159 40.4175 19.0678C38.1062 16.4432 34.4454 15.4622 31.1314 16.5796C30.3131 16.8556 29.431 17.3651 27.6669 18.3836L17.5182 24.243Z";
function WorkBuddyMark({ size = 16 }) {
  const uid = (0, import_react4.useId)().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `wbBg${uid}`;
  const fg = `wbFg${uid}`;
  const clip = `wbClip${uid}`;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { width: size, height: size, viewBox: "0 0 40 40", fill: "none", "aria-hidden": "true", style: { flex: "none" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("defs", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("linearGradient", { id: bg, x1: "20", y1: "0", x2: "20", y2: "40", gradientUnits: "userSpaceOnUse", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { stopColor: "#0EC8A9" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "1", stopColor: "#01C886" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("linearGradient", { id: fg, x1: "16.6642", y1: "11.0783", x2: "35.3762", y2: "43.4885", gradientUnits: "userSpaceOnUse", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { stopColor: "#FFFFFF", stopOpacity: "0.8" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "0.437689", stopColor: "#FFFFFF" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("clipPath", { id: clip, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { width: "40", height: "40", rx: "8.63158" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("g", { clipPath: `url(#${clip})`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { width: "40", height: "40", rx: "8.63158", fill: `url(#${bg})` }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { fillRule: "evenodd", clipRule: "evenodd", d: MARK_PATH, fill: `url(#${fg})` }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { x: "18.4961", y: "31.3344", width: "4.00904", height: "8.32646", rx: "2.00452", transform: "rotate(-30 18.4961 31.3344)", fill: "#FFFFFF" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { x: "29.3125", y: "25.0894", width: "4.00904", height: "8.32646", rx: "2.00452", transform: "rotate(-30 29.3125 25.0894)", fill: "#FFFFFF" })
    ] })
  ] });
}
function ModelNameLabel({ provider, model }) {
  const name3 = model?.name ?? model?.id ?? "";
  if (provider?.id !== WORKBUDDY_PROVIDER) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: row2, children: name3 });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: row2, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(WorkBuddyMark, {}),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: name3 })
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
var Credits = import_zod.z.object({
  enabled: import_zod.z.boolean(),
  sessionUsed: import_zod.z.number().optional(),
  accountRemain: import_zod.z.number().optional(),
  accountTotal: import_zod.z.number().optional(),
  unit: import_zod.z.string().optional(),
  plan: import_zod.z.string().optional()
});
var ContextModel = import_zod.z.object({
  id: import_zod.z.string(),
  name: import_zod.z.string(),
  contextWindow: import_zod.z.number().optional()
});
var Contexts = import_zod.z.object({
  models: import_zod.z.array(ContextModel),
  overrides: import_zod.z.record(import_zod.z.string(), import_zod.z.number())
});
var SetContextReply = import_zod.z.object({ ok: import_zod.z.boolean() });
var codec = (schema, name3) => ({
  mode: "strict",
  typeSymbol: "dsh-provider#workbuddy:" + name3,
  create: () => schema,
  jsonSchema: import_zod.z.toJSONSchema(schema)
});
var actionCodec = codec(Action, "action");
var sessionIdCodec = codec(import_zod.z.string(), "sessionId");
var refreshCodec = codec(import_zod.z.boolean(), "refresh");
var modelIdCodec = codec(import_zod.z.string(), "modelId");
var tokensCodec = codec(import_zod.z.number(), "tokens");
var REMOTE = createTypertRemoteInfo({ package: "dsh-provider", methods: {
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
  "workbuddyProvider/contexts": {
    service: "workbuddyProvider",
    invocation: { kind: "direct" },
    parameters: [],
    result: codec(Contexts, "contexts")
  },
  "workbuddyProvider/setContext": {
    service: "workbuddyProvider",
    invocation: { kind: "direct" },
    parameters: [
      { name: "modelId", source: "json", codec: modelIdCodec, strictCodec: modelIdCodec },
      { name: "tokens", source: "json", codec: tokensCodec, strictCodec: tokensCodec }
    ],
    result: codec(SetContextReply, "setContext")
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
  ctx.inject(["remote.workbuddyProvider", "modelDirectories"], mountCredits);
  mountModelLabel(ctx);
}
function mountModelLabel(ctx) {
  const slots = ctx.slots;
  slots.inject("conversation.input.model.label", () => slots.register({
    name: "conversation.input.model.label"
  }, ModelNameLabel));
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
    },
    contexts: async () => {
      const result = await ctx.remote.workbuddyProvider.contexts();
      if (!result.ok) throw new Error("WorkBuddy contexts unavailable");
      return result.value;
    },
    setContext: async (modelId, tokens) => {
      const result = await ctx.remote.workbuddyProvider.setContext(modelId, tokens);
      if (!result.ok) throw new Error("WorkBuddy context update refused");
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
