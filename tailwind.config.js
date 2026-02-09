const sdkThemeExtend = require('./ui/tailwind/sdk-theme.cjs')

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
