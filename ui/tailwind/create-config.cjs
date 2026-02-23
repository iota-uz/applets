const fs = require("fs");
const path = require("path");

const sdkTheme = require("./sdk-theme.cjs");
const { resolveIotaSdkTailwindContent } = require("./sdk-content.cjs");

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function mergeDeep(base, extra) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (isPlainObject(out[key]) && isPlainObject(value)) {
      out[key] = mergeDeep(out[key], value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim() !== "");
  }
  if (typeof value === "string" && value.trim() !== "") {
    return [value];
  }
  return [];
}

function shouldIncludeSdkTemplates(includeSdkTemplates, rootDir) {
  if (typeof includeSdkTemplates === "boolean") {
    return includeSdkTemplates;
  }
  return fs.existsSync(path.join(rootDir, "go.mod"));
}

/**
 * Creates a Tailwind config that extends the SDK theme (design tokens from iota.css).
 * @param { {
 *   content?: string[],
 *   extend?: Record<string, unknown>,
 *   plugins?: unknown[],
 *   includeSdkTemplates?: boolean,
 *   rootDir?: string,
 *   sdkContentOptions?: Record<string, unknown>
 * } } options
 * @returns { import('tailwindcss').Config }
 */
function createIotaTailwindConfig(options = {}) {
  const { content = [], extend = {}, plugins = [] } = options;
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const includeSdkTemplates = shouldIncludeSdkTemplates(
    options.includeSdkTemplates,
    rootDir
  );
  const sdkTemplateContent = includeSdkTemplates
    ? resolveIotaSdkTailwindContent({
        rootDir,
        ...(options.sdkContentOptions ?? {}),
      })
    : [];
  const mergedExtend = mergeDeep(sdkTheme, extend);
  const mergedContent = uniqueStrings([
    ...normalizeStringArray(content),
    ...normalizeStringArray(sdkTemplateContent),
  ]);

  return {
    darkMode: "class",
    content: mergedContent,
    theme: {
      extend: mergedExtend,
    },
    plugins,
  };
}

module.exports = createIotaTailwindConfig;
