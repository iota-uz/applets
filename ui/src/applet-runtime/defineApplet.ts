import { withRequestContext } from './context'

export type AppletDefinition = {
  fetch: (request: Request) => Response | Promise<Response>
}

type BunServeLike = {
  stop: (closeActiveConnections?: boolean) => void
}

type BunGlobal = {
  serve: (options: {
    unix: string
    fetch: (request: Request) => Response | Promise<Response>
  }) => BunServeLike
}

function requireUnixSocketPath(): string {
  const path = process.env.IOTA_APPLET_SOCKET
  if (!path || path.trim() === '') {
    throw new Error('IOTA_APPLET_SOCKET is required')
  }
  return path
}

export function defineApplet(definition: AppletDefinition): BunServeLike {
  const socketPath = requireUnixSocketPath()
  const bun = (globalThis as unknown as { Bun?: BunGlobal }).Bun
  if (!bun || typeof bun.serve !== 'function') {
    throw new Error('defineApplet requires Bun runtime')
  }
  return bun.serve({
    unix: socketPath,
    fetch: (request) => withRequestContext(request, () => definition.fetch(request)),
  })
}

