import { currentRequestOptional } from './context'
import { engine } from './engine'

export type StoredFile = {
  id: string
  name: string
  contentType?: string
  size: number
  path: string
  createdAt: string
}

function readEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`${name} is required`)
  }
  return value
}

function appletMethod(op: string): string {
  const appletID = process.env.IOTA_APPLET_ID
  if (!appletID || appletID.trim() === '') {
    throw new Error('IOTA_APPLET_ID is required')
  }
  return `${appletID}.files.${op}`
}

function buildEngineURL(pathname: string, socketPath: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `http://localhost${path}?socket=${encodeURIComponent(socketPath)}`
}

function forwardedHeaders(): Record<string, string> {
  const request = currentRequestOptional()
  const headers: Record<string, string> = {}
  if (!request) {
    return headers
  }
  const maybeForwardHeader = (headerName: string) => {
    const value = request.headers.get(headerName)
    if (value && value.trim() !== '') {
      headers[headerName] = value
    }
  }
  maybeForwardHeader('x-iota-tenant-id')
  maybeForwardHeader('x-iota-user-id')
  maybeForwardHeader('x-iota-request-id')
  return headers
}

async function toBytes(data: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (data instanceof Blob) {
    const buffer = await data.arrayBuffer()
    return new Uint8Array(buffer)
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }
  return data
}

async function toBase64(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = await toBytes(data)
  return Buffer.from(bytes).toString('base64')
}

async function requestFilesEndpoint<T>(
  path: string,
  options: RequestInit & { unix?: string; appletId: string },
): Promise<T> {
  const socketPath = readEnv('IOTA_ENGINE_SOCKET')
  const headers = new Headers(options.headers)
  headers.set('X-Iota-Applet-Id', options.appletId)
  for (const [name, value] of Object.entries(forwardedHeaders())) {
    headers.set(name, value)
  }
  const response = await fetch(buildEngineURL(path, socketPath), {
    ...options,
    headers,
    unix: socketPath,
  } as any)
  if (!response.ok) {
    throw new Error(`files endpoint HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

export const files = {
  async store(input: {
    name: string
    contentType?: string
    data: Blob | ArrayBuffer | Uint8Array
  }): Promise<StoredFile> {
    const appletID = readEnv('IOTA_APPLET_ID')
    try {
      const bytes = await toBytes(input.data)
      const exactBuffer =
        bytes.buffer instanceof ArrayBuffer
          ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          : Uint8Array.from(bytes).buffer
      return await requestFilesEndpoint<StoredFile>('/files/store', {
        appletId: appletID,
        method: 'POST',
        headers: {
          'X-Iota-File-Name': input.name,
          'X-Iota-Content-Type': input.contentType ?? '',
          'Content-Type': input.contentType ?? 'application/octet-stream',
        },
        body: new Blob([exactBuffer], { type: input.contentType ?? 'application/octet-stream' }),
      })
    } catch (error) {
      if (error instanceof TypeError || error instanceof ReferenceError) {
        throw error
      }
      const dataBase64 = await toBase64(input.data)
      return engine.call<StoredFile>(appletMethod('store'), {
        name: input.name,
        contentType: input.contentType ?? '',
        dataBase64,
      })
    }
  },
  async get(id: string): Promise<StoredFile | null> {
    const appletID = readEnv('IOTA_APPLET_ID')
    try {
      return await requestFilesEndpoint<StoredFile | null>(`/files/get?id=${encodeURIComponent(id)}&applet=${encodeURIComponent(appletID)}`, {
        appletId: appletID,
        method: 'GET',
      })
    } catch (error) {
      if (error instanceof TypeError || error instanceof ReferenceError) {
        throw error
      }
      return engine.call<StoredFile | null>(appletMethod('get'), { id })
    }
  },
  async delete(id: string): Promise<boolean> {
    const appletID = readEnv('IOTA_APPLET_ID')
    try {
      const result = await requestFilesEndpoint<{ ok: boolean }>(`/files/delete?id=${encodeURIComponent(id)}&applet=${encodeURIComponent(appletID)}`, {
        appletId: appletID,
        method: 'DELETE',
      })
      return result.ok
    } catch (error) {
      if (error instanceof TypeError || error instanceof ReferenceError) {
        throw error
      }
      return engine.call<boolean>(appletMethod('delete'), { id })
    }
  },
}
