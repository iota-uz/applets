/** Shared tsup entry points used by both tsup.config.ts and tsup.dev.config.ts */
export const sharedEntry = {
  index: 'ui/src/index.ts',
  'bichat/index': 'ui/src/bichat/index.ts',
  'bichat/tailwind': 'ui/src/bichat/tailwind.ts',
  'applet/vite': 'ui/src/applet-vite/index.ts',
  'applet/core': 'ui/src/applet-core/index.ts',
  'applet/host': 'ui/src/applet-host/index.ts',
  'applet/devtools': 'ui/src/applet-devtools/index.ts',
}
