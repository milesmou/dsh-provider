# Components

`dsh-provider` is the installable DSH bundle. Its `cordis.patch.yml` declares **two provider components**, which DSH lists as **CodeBuddy** and **Codex** with separate enable switches, plus a shared browser-loading group. CodeBuddy owns WorkBuddy sign-in and CodeBuddy API-key access. Codex owns local ChatGPT sign-in and the Codex Responses route.

```text
src/
  index.ts                  # Shared browser-loading group and legacy CodeBuddy alias
  config.ts                 # Original namespaced CodeBuddy configuration
  client/index.tsx          # Client component composition
  client/settings-page.tsx  # Dedicated Model Extensions settings page and card slot
  client/model-label.tsx    # Shared model label dispatch for provider icons
  remote.ts                 # Package-wide Typert manifest
  components/
    workbuddy/
      entry.ts              # CodeBuddy Loader entry and settings presentation
      index.ts              # WorkBuddy routes and lifecycle
      config.ts             # Component schema
      session.ts            # Desktop/browser sign-in
      adapter.ts            # Model streaming and refusal retries
      shaping.ts            # Prompt spelling and refusal repair
      tool-schema.ts        # Tool schema and name normalization
      catalog.ts            # Startup model discovery
      controller.ts         # WorkBuddy login commands
      remote.ts             # Component Remote descriptors
      client/               # Component settings UI
    codex/
      index.ts              # Separate Codex Loader entry
      client/               # Codex settings UI
test/
  plugin.test.mjs           # Real Loader composition, metadata and independent switches
  components/workbuddy/     # WorkBuddy behavior
```

To add another Agent, create a sibling under `src/components/`, export its Host schema and lifecycle through a package subpath, and insert a separate entry in `cordis.patch.yml`. A nested `ctx.plugin()` alone is not a separately manageable component in DSH's plugin inventory. Export `<component subpath>/locale/*.json` with component-specific `meta.title` and `meta.description`; the bundle's root locale remains the package description. Register its Client in `src/client/index.tsx` and aggregate its Remote descriptors in `src/remote.ts`. Use its own route, credential keys, Remote namespace and settings slot ID. Every Remote descriptor must name the owning npm package, `dsh-provider`.

CodeBuddy retains the Loader entry id and settings namespace `dsh-provider`, with values under `workbuddy`; its module name is `dsh-provider/components/workbuddy`. This preserves the original account, context-window preferences and credential keys. Codex uses its own Loader id/settings namespace `dsh-provider-codex` and module `dsh-provider/components/codex`. Disabling either component disposes only its own routes and controller. Disabling the bundle disposes both.

DSH's browser-module registry only discovers package-root Loader names, so the bundle also inserts `dsh-provider-client`, an empty group with `name: dsh-provider`. Groups do not appear as provider components in the plugin inventory. This root entry loads the existing shared `./client` bundle once; each settings card still follows the availability of its own Host Remote. When mounted as a group, the package root creates an empty Cordis group; ordinary entries retain the original CodeBuddy compatibility behavior. Keep this root group when adding more subpath components, or the model-settings cards will disappear even though the Host components run.

The shared client mounts one combined Remote contribution for the package. Components must not mount their own contribution with the same package name: DSH rejects duplicate Remote packages. Settings cards register in `dsh-provider.settings.cards`, declared and rendered by the dedicated **模型扩展** page in `settings.section`; they no longer occupy `settings.models.footer`. The shared client also owns the single model-label slot, preserving WorkBuddy's mark and credit multiplier while adding the user-selected white OpenAI knot tile to Codex models in the menu and current-model trigger.

DSH rc.3 chooses settings-navigation glyphs from built-in section IDs and exposes no custom-icon option. `client/settings-nav-icon.ts` styles only the **模型扩展** navigation row with a puzzle glyph, without changing the shell or reusing a built-in section ID. It observes the settings navigation while open and removes its stylesheet, marker attributes and observers on disposal; an unrecognized shell structure retains DSH's default glyph.

Both cards render the shared `client/model-manager.tsx` panel. Their `models` Remotes return complete catalog metadata, including models hidden by the user; `hiddenModels` is a volatile field under `workbuddy` for CodeBuddy and at the Codex namespace root. Only adapter `listModels` results are filtered. Resolution remains available for existing model selections, preferences survive catalog replacement, and `loader/volatile-update` invalidates the model directory without remounting providers. Each preference write reads the latest settings revision and merges only its component's visibility field.

WorkBuddy's chat requests are shaped before they leave the component, following [magpie](https://github.com/yetone/magpie)'s WorkBuddy package: `shaping.ts` rewrites the client identity lines WorkBuddy refuses, moves a refused system prompt into the first user message once, and normalizes the request spellings WorkBuddy's chat endpoint takes; `tool-schema.ts` mends tool schemas (unions, enums, boolean subschemas, tuples, `$ref`) and makes tool names acceptable, mapping the model's calls back to DSH's names. `adapter.ts` applies each repair once per adapter run and remembers it, so later requests go out repaired from the start.

CodeBuddy API-key requests to the official regional gateways use the same request shaping while retaining API-key authentication. Chat and catalog requests share the CodeBuddy User-Agent and report `CodeBuddy` in `X-IDE-Type` and `X-IDE-Name`; WorkBuddy sign-in retains its own client identity. API-key access has only two fixed endpoints: `https://copilot.tencent.com/v2` and `https://www.codebuddy.ai/v2`; `environment` or `CODEBUDDY_INTERNET_ENVIRONMENT` selects the region. There is no configurable `baseURL`, `CODEBUDDY_BASE_URL` override, or custom-gateway model discovery. Tests inject a transport that redirects these fixed URLs to a local fixture rather than configuring a production endpoint.

WorkBuddy owns the `workbuddy` model route. Its API-key storage reference is `DSH_PROVIDER_WORKBUDDY_API_KEY`, and its browser logins use `dsh-provider/workbuddy-cn` or `dsh-provider/workbuddy-intl`. These keys are isolated from other components and do not enable environment-variable authentication.

`workbuddy/api-credits.ts` supplies the same session-header credit display for API-key mode. It reads `/v2/billing/meter/get-user-resource` on the selected official gateway, validates the complete resource directory and current credit capacities, and shares a 60-second balance cache across sessions. Exact `usage.credit` charges are recorded against the request's credential fingerprint and session; the remaining balance is projected using all recorded account charges after its snapshot. Changed or removed keys invalidate pending requests and cached balances, unauthorized replies clear the balance, and transient failures label retained data as cached. Only credit figures and safe status fields reach the browser. WorkBuddy sign-in keeps its existing separate ledger behavior.

`npm run build` cleans only the generated `lib/` directory before rebuilding, so moved or removed components cannot leave stale modules in published packages. Commit the generated output because Git-hosted installation must not require build scripts.

`src/components/codex/` owns the `codex` model route, the `codexProvider` Remote namespace, and the `codex` settings slot. Its standalone Config accepts `codexHome` and `timeoutMs`. `session.ts` reads the selected Codex home's `auth.json` without exporting secrets to the client or modifying the file. `catalog.ts` discovers models from Codex's cache and live account directory. `adapter.ts` maps Responses events to DSH blocks and stores encrypted reasoning in per-block replay metadata. `messages.ts` sends full history, including function calls/results and same-model reasoning, on every request. It only declares tools for DSH to execute; it does not start a separate Codex agent loop.

Codex credentials are independent of DSH's WorkBuddy credential keys. `codexHome` overrides the launch environment's `CODEX_HOME`, then defaults to `~/.codex`. Token renewal remains owned by the local Codex client; expired or keychain-only credentials produce an actionable settings diagnostic.

`codex/quota.ts` reads the account's `/backend-api/wham/usage` quota windows with the same local login. The `codexProvider/quota` Remote exposes only usage percentages, durations, reset/update timestamps, plan and safe status text. Its 60-second cache and in-flight reads are shared across sessions and isolated by a hash of the account and token; login changes invalidate cached data and late replies. No account ID, email, token or raw response reaches the browser. The `codex-quota` header entry renders only while that session selects the `codex` route, supports manual refresh, and tears down subscriptions and polling when hidden. Window percentages describe the shared account allowance rather than a session token budget; unknown windows remain unavailable, and failed refreshes explicitly label a retained snapshot as cached.
