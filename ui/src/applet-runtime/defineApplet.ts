import { withRequestContext } from './context'
import { dispatchBridgeEvent } from './ws'

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
    fetch: (request) =>
      withRequestContext(request, async () => {
        const url = new URL(request.url)
        if (request.method === 'POST' && url.pathname === '/__ws') {
          let payload: {
            connectionId: string
            event: 'open' | 'message' | 'close'
            dataBase64?: string
          }
          try {
            payload = (await request.json()) as {
              connectionId: string
              event: 'open' | 'message' | 'close'
              dataBase64?: string
            }
          } catch {
            return new Response(JSON.stringify({ error: 'invalid_json' }), {
              status: 400,
              headers: { 'content-type': 'application/json; charset=utf-8' },
            })
          }
          if (!payload?.connectionId || !payload?.event) {
            return new Response(JSON.stringify({ error: 'invalid_payload' }), {
              status: 400,
              headers: { 'content-type': 'application/json; charset=utf-8' },
            })
          }
          if (!['open', 'message', 'close'].includes(payload.event)) {
            return new Response(JSON.stringify({ error: 'invalid_payload' }), {
              status: 400,
              headers: { 'content-type': 'application/json; charset=utf-8' },
            })
          }
          await dispatchBridgeEvent(payload)
          return new Response(JSON.stringify({ ok: true }), {
            status: 202,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          })
        }
        return definition.fetch(request)
      }),
  })
}
