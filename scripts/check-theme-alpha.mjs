#!/usr/bin/env node

/**
 * Guards the one invariant that ties iota.css to sdk-theme.cjs:
 *
 *   A design token whose *value* already carries an alpha channel must not be
 *   wrapped in `oklch(var(--token) / <alpha-value>)` by the Tailwind theme.
 *
 * Tailwind substitutes `<alpha-value>` with `1` for a plain utility, so a token
 * defined as `--red-100: var(--red-500) / 10%` expands to
 *
 *   background-color: oklch(59.16% 0.218 0.58 / 10% / 1)
 *
 * which has two slashes, is invalid, and is dropped by the browser. The utility
 * then renders with no colour at all — silently, with no build error. That is
 * how `bg-red-100` (alert.Error) and every `bg-badge-*` variant lost their fill.
 *
 * Such tokens must be referenced as `oklch(var(--token))`, the same way
 * backgroundColor.surface.* and backgroundColor.avatar already are.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const iotaCssPath = path.join(root, "styles", "tailwind", "iota.css");
const themePath = path.join(root, "ui", "tailwind", "sdk-theme.cjs");

const iotaCss = fs.readFileSync(iotaCssPath, "utf8");
const theme = fs.readFileSync(themePath, "utf8");

// A token "carries alpha" when any of its declared values contains a slash.
// `--transparent` is excluded: it is a fully transparent sentinel, never a base
// colour a utility composes on top of.
const carriesAlpha = new Set();
for (const [, name, value] of iotaCss.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
  if (value.includes("/") && name !== "--transparent") {
    carriesAlpha.add(name);
  }
}

const violations = [];
for (const line of theme.split("\n")) {
  const match = line.match(/oklch\(var\((--[a-z0-9-]+)\)\s*\/\s*<alpha-value>\)/);
  if (match && carriesAlpha.has(match[1])) {
    violations.push(
      `${match[1]} already carries an alpha channel in iota.css; ` +
        `reference it as oklch(var(${match[1]})) — got: ${line.trim()}`,
    );
  }
}

if (violations.length > 0) {
  console.error("Theme alpha checks failed:");
  for (const v of violations) {
    console.error(`- ${v}`);
  }
  process.exit(1);
}

console.log(
  `Theme alpha checks passed (${carriesAlpha.size} alpha-carrying tokens verified).`,
);
