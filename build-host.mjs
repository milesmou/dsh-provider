import { lstat, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { basename, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('.', import.meta.url))
const output = fileURLToPath(new URL('./lib', import.meta.url))
if (basename(output) !== 'lib' || dirname(output) !== root.replace(/[\\/]$/, '')) throw new Error('Unexpected build output directory')
const info = await lstat(output).catch(error => { if (error.code !== 'ENOENT') throw error })
if (info?.isSymbolicLink()) throw new Error('Refusing to clean a linked output directory')
await rm(output, { recursive: true, force: true })
const tsc = fileURLToPath(new URL('./node_modules/typescript/bin/tsc', import.meta.url))
const result = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit', windowsHide: true })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
