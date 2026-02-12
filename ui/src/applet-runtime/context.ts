import { AsyncLocalStorage } from 'node:async_hooks'

type RequestContext = {
  request: Request
}

const requestContextStore = new AsyncLocalStorage<RequestContext>()

export function withRequestContext<T>(request: Request, fn: () => T): T {
  return requestContextStore.run({ request }, fn)
}

export function currentRequest(): Request {
  const ctx = requestContextStore.getStore()
  if (!ctx?.request) {
    throw new Error('No active applet request context. Use defineApplet({ fetch }) to establish request context.')
  }
  return ctx.request
}

export function currentRequestOptional(): Request | undefined {
  return requestContextStore.getStore()?.request
}
