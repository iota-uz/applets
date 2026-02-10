import { cp, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve repo root from this script's location so output is always at repo-root/tailwind
// (avoids wrong path when pnpm runs from a workspace package, e.g. cwd = ui/)
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const outDir = path.join(repoRoot, 'tailwind')
const sdkTailwindDir = path.join(repoRoot, 'node_modules', '@iota-uz', 'sdk', 'tailwind')

// Rely on the published @iota-uz/sdk tailwind output (devDependency) so we don't duplicate CSS/config source files
const entries = await readdir(sdkTailwindDir, { withFileTypes: true }).catch((err) => {
  if (err.code === 'ENOENT') {
    throw new Error(
      `Tailwind source not found at ${sdkTailwindDir}. Add "@iota-uz/sdk" as a devDependency (e.g. "0.3.x") and run pnpm install. If building this package, ensure the published SDK version includes the tailwind/ folder.`
    )
  }
  throw err
})

await mkdir(outDir, { recursive: true })

for (const e of entries) {
  const src = path.join(sdkTailwindDir, e.name)
  const dest = path.join(outDir, e.name)
  await cp(src, dest, { recursive: e.isDirectory() })
}
