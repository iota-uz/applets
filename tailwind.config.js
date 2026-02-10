/* eslint-env node */
// Uses built tailwind/ (populated by build:tailwind from local styles/ and ui/tailwind/).
// Run `pnpm run build:tailwind` (or build script that runs it) before Tailwind so this file exists.
let sdkThemeExtend;
try {
  sdkThemeExtend = require("./tailwind/sdk-theme.cjs");
} catch (e) {
  if (e.code === "MODULE_NOT_FOUND") {
    throw new Error(
      "tailwind/sdk-theme.cjs not found. Run the tailwind build first (e.g. pnpm run build:tailwind)."
    );
  }
  throw e;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./ui/**/*.{html,js,ts,tsx}",
    "./tailwind/**/*.css",
  ],
  theme: {
    extend: sdkThemeExtend,
  },
  plugins: [],
};
