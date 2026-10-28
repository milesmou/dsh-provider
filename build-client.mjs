import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'))
// DSH loads client plugins through its shared module registry, rather than
// importing ESM files. Keep React external so hooks use the shell's instance.
await build({
  entryPoints: ['src/client/index.tsx'], outfile: 'lib/client.js',
  bundle: true, format: 'cjs', platform: 'browser', target: 'es2022',
  packages: 'bundle', external: ['react', 'react/*', '@deepseek-ai/cordis', 'zod'], jsx: 'automatic',
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
})
