const sdkTheme = require("./sdk-theme.cjs");

/**
 * Creates a Tailwind config that extends the SDK theme (design tokens from iota.css).
 * @param { { content?: string[], extend?: Record<string, unknown>, plugins?: unknown[] } } options
 * @returns { import('tailwindcss').Config }
 */
function createIotaTailwindConfig(options = {}) {
  const { content = [], extend = {}, plugins = [] } = options;
  return {
    darkMode: "class",
    content,
    theme: {
      extend: {
        ...sdkTheme,
        ...extend,
      },
    },
    plugins,
  };
}

module.exports = createIotaTailwindConfig;
