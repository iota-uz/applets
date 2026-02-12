// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { withRequestContext } from './context'
import { engine } from './engine'

describe('engine.call', () => {
  const originalFetch = globalThis.fetch
  const originalSocket = process.env.IOTA_ENGINE_SOCKET

  beforeEach(() => {
    process.env.IOTA_ENGINE_SOCKET = '/tmp/iota-engine.sock'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env.IOTA_ENGINE_SOCKET = originalSocket
  })

  it('maps request/response payload and forwards headers', async () => {
    const fetchMock = mock(async (_url: string, init: any) => {
      expect(init.unix).toBe('/tmp/iota-engine.sock')
      expect(init.headers['x-iota-tenant-id']).toBe('tenant-1')
      expect(init.headers['x-iota-user-id']).toBe('user-1')
      expect(init.headers['x-iota-request-id']).toBe('req-1')

      const body = JSON.parse(String(init.body))
      expect(body.method).toBe('bichat.kv.get')
      expect(body.params).toEqual({ key: 'k1' })

      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: { value: 'v1' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
    globalThis.fetch = fetchMock as any

    const request = new Request('http://localhost/__probe', {
      headers: {
        'x-iota-tenant-id': 'tenant-1',
        'x-iota-user-id': 'user-1',
        'x-iota-request-id': 'req-1',
      },
    })

    const result = await withRequestContext(request, () => engine.call('bichat.kv.get', { key: 'k1' }))
    expect(result).toEqual({ value: 'v1' })
  })

  it('throws on rpc error responses', async () => {
    const fetchMock = mock(async (_url: string, init: any) => {
      const body = JSON.parse(String(init.body))
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32603, message: 'Internal error' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
    globalThis.fetch = fetchMock as any

    await expect(engine.call('bichat.kv.get', { key: 'k1' })).rejects.toThrow('-32603: Internal error')
  })
})
