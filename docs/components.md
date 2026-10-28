# Components

`dsh-provider` is the installable DSH plugin. Each supported Agent lives in its own component. WorkBuddy is the first component and owns both WorkBuddy sign-in and CodeBuddy API-key access.

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
      adapter.ts            # Model streaming
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

WorkBuddy owns the `workbuddy` model route. Its API-key storage reference is `DSH_PROVIDER_WORKBUDDY_API_KEY`, and its browser logins use `dsh-provider/workbuddy-cn` or `dsh-provider/workbuddy-intl`. These keys are isolated from other components and do not enable environment-variable authentication.

`npm run build` cleans only the generated `lib/` directory before rebuilding, so moved or removed components cannot leave stale modules in published packages. Commit the generated output because Git-hosted installation must not require build scripts.
