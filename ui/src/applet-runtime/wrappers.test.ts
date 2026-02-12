// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { db } from './db'
import { jobs } from './jobs'
import { kv } from './kv'
import { secrets } from './secrets'

describe('kv/db wrappers', () => {
  const originalFetch = globalThis.fetch
  const originalAppletID = process.env.IOTA_APPLET_ID
  const originalSocket = process.env.IOTA_ENGINE_SOCKET

  beforeEach(() => {
    process.env.IOTA_APPLET_ID = 'bichat'
    process.env.IOTA_ENGINE_SOCKET = '/tmp/iota-engine.sock'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env.IOTA_APPLET_ID = originalAppletID
    process.env.IOTA_ENGINE_SOCKET = originalSocket
  })

  it('routes kv/db helper calls to expected rpc methods', async () => {
    const calledMethods: string[] = []

    globalThis.fetch = mock(async (_url: string, init: any) => {
      const body = JSON.parse(String(init.body))
      calledMethods.push(body.method)
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as any

    await kv.get('k1')
    await kv.set('k1', { ok: true })
    await kv.del('k1')
    await kv.mget(['k1', 'k2'])

    await db.get('d1')
    await db.query('messages')
    await db.insert('messages', { text: 'hello' })
    await db.patch('d1', { text: 'patched' })
    await db.replace('d1', { text: 'replaced' })
    await db.delete('d1')
    await jobs.enqueue('bichat.worker.run', { z: 1 })
    await jobs.schedule('0 * * * *', 'bichat.worker.schedule', { z: 2 })
    await jobs.list()
    await jobs.cancel('job-1')
    await secrets.get('openai_api_key')

    expect(calledMethods).toEqual([
      'bichat.kv.get',
      'bichat.kv.set',
      'bichat.kv.del',
      'bichat.kv.mget',
      'bichat.db.get',
      'bichat.db.query',
      'bichat.db.insert',
      'bichat.db.patch',
      'bichat.db.replace',
      'bichat.db.delete',
      'bichat.jobs.enqueue',
      'bichat.jobs.schedule',
      'bichat.jobs.list',
      'bichat.jobs.cancel',
      'bichat.secrets.get',
    ])
  })
})
