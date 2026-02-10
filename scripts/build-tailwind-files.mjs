import { cp, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Copies tailwind/ from the published @iota-uz/sdk devDependency into repo-root/tailwind/.
 *
 * Circular bootstrapping: this package IS @iota-uz/sdk. We list ourselves as a devDependency
 * at a pinned version (e.g. 0.3.x) so pnpm install fetches the published package, whose
 * tailwind/ folder we copy here. That avoids duplicating CSS/config source in this repo.
 * Downside: until the devDependency version is bumped, we copy tailwind output from the
 * previous published release. When releasing a new version, either (1) publish once so the
 * new version is on the registry, then bump the devDependency range and re-run build, or
 * (2) accept that the first publish of a new major will ship tailwind from the previous
 * published version until the next release.
 */

// Resolve repo root from this script's location so output is always at repo-root/tailwind
// (avoids wrong path when pnpm runs from a workspace package, e.g. cwd = ui/)
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const outDir = path.join(repoRoot, 'tailwind')
const sdkTailwindDir = path.join(repoRoot, 'node_modules', '@iota-uz', 'sdk', 'tailwind')
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
