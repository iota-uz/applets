// Uses built tailwind/ (populated by build:tailwind from local styles/ and ui/tailwind/)
const sdkThemeExtend = require("./tailwind/sdk-theme.cjs");

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
