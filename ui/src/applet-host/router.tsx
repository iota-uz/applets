import type React from 'react'

export type RouterMode = 'url' | 'memory'

export interface CreateAppletRouterOptions {
  mode: RouterMode
  basePath?: string
  BrowserRouter: React.ComponentType<Record<string, unknown>>
  MemoryRouter: React.ComponentType<Record<string, unknown>>
}

export function createAppletRouter(options: CreateAppletRouterOptions) {
  const basePath = options.basePath ?? ''

  const Router: React.FC<React.PropsWithChildren> = ({ children }) => {
    if (options.mode === 'memory') {
      const MemoryRouter = options.MemoryRouter
      return <MemoryRouter>{children}</MemoryRouter>
    }

    const BrowserRouter = options.BrowserRouter
    return <BrowserRouter basename={basePath}>{children}</BrowserRouter>
  }

  return { Router }
}

