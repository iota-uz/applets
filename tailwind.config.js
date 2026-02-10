// Use built tailwind output (populated by build:tailwind from @iota-uz/sdk)
const path = require('path')
const sdkThemeExtend = require(path.join(__dirname, 'tailwind', 'sdk-theme.cjs'))

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
}
