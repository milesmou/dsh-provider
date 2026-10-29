# Components

`dsh-provider` is the installable DSH plugin. Each supported Agent lives in its own component. WorkBuddy owns WorkBuddy sign-in and CodeBuddy API-key access. Codex owns local ChatGPT sign-in and the Codex Responses route.

```text
src/
  index.ts                  # Host component composition and settings presentation
  config.ts                 # Namespaced component configuration
  client/index.tsx          # Client component composition
  remote.ts                 # Package-wide Typert manifest
  components/
    workbuddy/
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
test/
  plugin.test.mjs           # Root composition and package identity
  components/workbuddy/     # WorkBuddy behavior
```

To add another Agent, create a sibling under `src/components/`, export its Host schema and lifecycle, and register it in the root `config.ts` and `index.ts`. Register its Client in `src/client/index.tsx` and aggregate its Remote descriptors in `src/remote.ts`. Use its own configuration node, route, credential keys, Remote namespace, and settings slot ID. Every Remote descriptor must name the owning npm package, `dsh-provider`.

Only the root Loader entry owns the settings namespace (`dsh-provider`). WorkBuddy edits paths under `workbuddy`, and its Host component reacts to that namespace's settings events. Component lifecycles remain scoped to the root plugin; unloading it disposes all components.

WorkBuddy's chat requests are shaped before they leave the component, following [magpie](https://github.com/yetone/magpie)'s WorkBuddy package: `shaping.ts` rewrites the client identity lines WorkBuddy refuses, moves a refused system prompt into the first user message once, and normalizes the request spellings WorkBuddy's chat endpoint takes; `tool-schema.ts` mends tool schemas (unions, enums, boolean subschemas, tuples, `$ref`) and makes tool names acceptable, mapping the model's calls back to DSH's names. `adapter.ts` applies each repair once per adapter run and remembers it, so later requests go out repaired from the start.

WorkBuddy owns the `workbuddy` model route. Its API-key storage reference is `DSH_PROVIDER_WORKBUDDY_API_KEY`, and its browser logins use `dsh-provider/workbuddy-cn` or `dsh-provider/workbuddy-intl`. These keys are isolated from other components and do not enable environment-variable authentication.

`npm run build` cleans only the generated `lib/` directory before rebuilding, so moved or removed components cannot leave stale modules in published packages. Commit the generated output because Git-hosted installation must not require build scripts.

`src/components/codex/` owns the `codex` configuration node and model route, the `codexProvider` Remote namespace, and the `codex` settings slot. `session.ts` reads the selected Codex home's `auth.json` without exporting secrets to the client or modifying the file. `catalog.ts` discovers models from Codex's cache and live account directory. `adapter.ts` maps Responses events to DSH blocks and stores encrypted reasoning in per-block replay metadata. `messages.ts` sends full history, including function calls/results and same-model reasoning, on every request. It only declares tools for DSH to execute; it does not start a separate Codex agent loop.

Codex credentials are independent of DSH's WorkBuddy credential keys. `codexHome` overrides the launch environment's `CODEX_HOME`, then defaults to `~/.codex`. Token renewal remains owned by the local Codex client; expired or keychain-only credentials produce an actionable settings diagnostic.
