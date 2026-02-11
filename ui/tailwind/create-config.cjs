const sdkTheme = require("./sdk-theme.cjs");

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

/**
 * Creates a Tailwind config that extends the SDK theme (design tokens from iota.css).
 * @param { { content?: string[], extend?: Record<string, unknown>, plugins?: unknown[] } } options
 * @returns { import('tailwindcss').Config }
 */
function createIotaTailwindConfig(options = {}) {
  const { content = [], extend = {}, plugins = [] } = options;
  const mergedExtend = mergeDeep(sdkTheme, extend);
  return {
    darkMode: "class",
    content,
    theme: {
      extend: mergedExtend,
    },
    plugins,
  };
}

module.exports = createIotaTailwindConfig;
