export {
  createAppletViteConfig,
  createAppletBackendProxy,
  createLocalSdkAliases,
  getAppletAssetsBase,
  getAppletVitePort,
} from './vite'
export type { AppletViteOptions } from './vite'

export {
  createAppletStylesVirtualModulePlugin,
  createBichatStylesPlugin,
  VIRTUAL_APPLET_STYLES_ID,
} from './styles-plugin'
export type { AppletStylesVirtualModuleOptions } from './styles-plugin'
