import { currentRequestOptional } from './context'

type EngineCallOptions = {
  timeoutMs?: number
}

type JsonRpcRequest = {
  id: string
  method: string
  params: unknown
}

type JsonRpcResponse = {
  id?: string
  result?: unknown
  error?: {
    code: string | number
    message: string
    details?: unknown
  }
}

const defaultEnginePath = '/rpc'

function readEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`${name} is required`)
  }
  return value
}

function buildEngineURL(pathname: string): string {
  const socketPath = readEnv('IOTA_ENGINE_SOCKET')
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  // Bun's fetch supports unix socket via the `unix` init option; URL host is ignored in that case.
  // We still keep a regular URL shape for portability in tests/mocks.
  return `http://localhost${path}?socket=${encodeURIComponent(socketPath)}`
}

function randomID(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } }
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function postJSON(pathname: string, body: unknown, timeoutMs?: number): Promise<JsonRpcResponse> {
  const socketPath = readEnv('IOTA_ENGINE_SOCKET')
  const request = currentRequestOptional()
  const forwardedHeaders: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (request) {
    const maybeForwardHeader = (headerName: string) => {
      const value = request.headers.get(headerName)
      if (value && value.trim() !== '') {
        forwardedHeaders[headerName] = value
      }
    }
    maybeForwardHeader('x-iota-tenant-id')
    maybeForwardHeader('x-iota-user-id')
    maybeForwardHeader('x-iota-permissions')
    maybeForwardHeader('x-iota-request-id')
  }

  const abortController = typeof timeoutMs === 'number' && timeoutMs > 0 ? new AbortController() : undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (abortController && timeoutMs) {
      timer = setTimeout(() => abortController.abort(), timeoutMs)
    }

    const init: RequestInit & { unix?: string } = {
      method: 'POST',
      headers: forwardedHeaders,
      body: JSON.stringify(body),
      signal: abortController?.signal,
      unix: socketPath,
    }
    const response = await fetch(buildEngineURL(pathname), init)
    if (!response.ok) {
      throw new Error(`engine RPC HTTP ${response.status}`)
    }
    return (await response.json()) as JsonRpcResponse
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export const engine = {
  async call<TResult = unknown>(method: string, params: unknown, options?: EngineCallOptions): Promise<TResult> {
    const request: JsonRpcRequest = {
      id: randomID(),
      method,
      params,
    }
    const response = await postJSON(defaultEnginePath, request, options?.timeoutMs)
    if (response.error) {
      throw new Error(`${response.error.code}: ${response.error.message}`)
    }
    return response.result as TResult
  },
}
