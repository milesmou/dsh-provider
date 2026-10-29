import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Every test file that mounts the plugin runs against a throwaway DSH home.
 * The plugin derives its credit ledger from resolveDshHome(), so without this
 * isolation a test run would rewrite the developer's real ledger.
 */
const home = mkdtempSync(join(tmpdir(), 'dsh-provider-test-home-'))
mkdirSync(join(home, 'storages'), { recursive: true })
process.env.DSH_HOME = home
// Bundle composition also mounts Codex. Keep test discovery away from real logins.
export const CODEX_TEST_HOME = join(home, 'codex')

/** Redirect fixed official gateway URLs to an explicit local test server, without exposing a runtime URL option. */
export function mockCodeBuddyGateway(t, origin) {
  const networkFetch = globalThis.fetch
  t.mock.method(globalThis, 'fetch', (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (!['copilot.tencent.com', 'www.codebuddy.ai'].includes(url.hostname)) {
      throw new Error('Unexpected gateway request in test')
    }
    return networkFetch(new Request(new URL(url.pathname + url.search, origin), request))
  })
}

process.on('exit', () => {
  try { rmSync(home, { recursive: true, force: true }) } catch { /* best effort */ }
})
