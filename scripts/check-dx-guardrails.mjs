#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];

const sdkLocalPattern = /@iota-uz\/sdk[\s\S]{0,160}(link:|file:|workspace:)/m;
const machinePathPattern = /(?:\/Users\/|\/home\/|[A-Za-z]:\\|\\Users\\|Library\/pnpm\/global\/)/m;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (entry.name === "package.json" || entry.name === "pnpm-lock.yaml" || entry.name === "pnpm-workspace.yaml") {
      const content = fs.readFileSync(full, "utf8");
      if (sdkLocalPattern.test(content)) {
        violations.push(`${path.relative(root, full)} contains local link/file/workspace @iota-uz/sdk references.`);
      }
      if (content.includes("@iota-uz/sdk") && machinePathPattern.test(content)) {
        violations.push(`${path.relative(root, full)} contains machine-specific path near @iota-uz/sdk.`);
      }
    }
  }
}

const packageJsonPath = path.join(root, "package.json");
const pkg = readJson(packageJsonPath);

if (pkg.name !== "@iota-uz/sdk") {
  violations.push(`package.json name must be "@iota-uz/sdk" in applets, got "${pkg.name ?? ""}".`);
}
if (pkg.private !== false) {
  violations.push("package.json must remain publishable (private=false) for canonical @iota-uz/sdk.");
}
if (pkg.dependencies?.["@iota-uz/sdk"] || pkg.devDependencies?.["@iota-uz/sdk"]) {
  violations.push("package.json must not depend on @iota-uz/sdk itself.");
}

walk(root);

if (violations.length > 0) {
  console.error("DX guardrail checks failed:");
  for (const v of violations) {
    console.error(`- ${v}`);
  }
  process.exit(1);
}

console.log("DX guardrail checks passed.");
