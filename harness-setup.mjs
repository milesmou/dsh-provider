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
process.on('exit', () => {
  try { rmSync(home, { recursive: true, force: true }) } catch { /* best effort */ }
})
