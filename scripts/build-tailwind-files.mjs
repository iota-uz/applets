/**
 * Builds tailwind/ from local source in this repo (no copy from node_modules).
 * Produces: tailwind/iota.css, main.css, sdk-theme.cjs, create-config.cjs, compiled.css.
 */
import { cp, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const outDir = path.join(repoRoot, "tailwind");

await mkdir(outDir, { recursive: true });

const iotaCssPath = path.join(outDir, "iota.css");
await cp(path.join(repoRoot, "styles", "tailwind", "iota.css"), iotaCssPath);

const mainCssPath = path.join(outDir, "main.css");
await writeFile(
  mainCssPath,
  `@import "tailwindcss";\n@import "./iota.css";\n`,
  "utf8",
);

const sdkThemePath = path.join(outDir, "sdk-theme.cjs");
await cp(path.join(repoRoot, "ui", "tailwind", "sdk-theme.cjs"), sdkThemePath);

const createConfigPath = path.join(outDir, "create-config.cjs");
await cp(
  path.join(repoRoot, "ui", "tailwind", "create-config.cjs"),
  createConfigPath,
);

const compiledInputPath = path.join(repoRoot, "styles", "tailwind", "input.css");
const compiledCssPath = path.join(outDir, "compiled.css");

const compiled = spawnSync(
  "pnpm",
  [
    "exec",
    "tailwindcss",
    "--input",
    compiledInputPath,
    "--output",
    compiledCssPath,
    "--minify",
  ],
  { cwd: repoRoot, stdio: "inherit" },
);

if (compiled.status !== 0) {
  const msg =
    compiled.error != null
      ? String(compiled.error)
      : `tailwindcss compilation failed with exit code ${compiled.status ?? "unknown"}`;
  throw new Error(msg);
}
