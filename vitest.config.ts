import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['ui/src/**/*.test.ts', 'ui/src/**/*.test.tsx'],
    exclude: ['ui/src/applet-runtime/**', 'node_modules/**'],
  },
})
