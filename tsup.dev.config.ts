import { defineConfig } from 'tsup'
import { sharedEntry } from './tsup.shared'

export default defineConfig({
  entry: sharedEntry,
  outDir: 'dist',
  format: ['esm'],
  outExtension() {
    return { js: '.mjs' }
  },
  dts: false,
  sourcemap: false,
  clean: false,
  treeshake: false,
  splitting: false,
  external: ['react', 'react-dom'],
})
