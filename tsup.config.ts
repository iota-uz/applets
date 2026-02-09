import { defineConfig } from 'tsup'
import { sharedEntry } from './tsup.shared'

export default defineConfig({
  entry: sharedEntry,
  outDir: 'dist',
  format: ['esm', 'cjs'],
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' }
  },
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: [
    'react',
    'react-dom',
    'node:fs',
    'node:path',
    'node:module',
    'node:child_process',
    'node:os',
  ],
})
