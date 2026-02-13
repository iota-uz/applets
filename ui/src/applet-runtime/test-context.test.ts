// @ts-nocheck
import { describe, expect, it } from 'bun:test'
import { z } from 'zod'

import { createTestContext } from './test-context'
import { defineSchema, defineTable, id } from './schema'

describe('createTestContext', () => {
  it('supports auth/kv/db/jobs/secrets/files without engine socket', async () => {
    const ctx = createTestContext({
      appletId: 'bichat',
      user: { id: 'u-1', tenantId: 't-1', permissions: ['BiChat.Access'] },
      secrets: { OPENAI_API_KEY: 'secret' },
      engineHandlers: {
        'bichat.custom.echo': (params) => ({ echoed: params }),
      },
    })

    const user = await ctx.auth.currentUser()
    expect(user.id).toBe('u-1')
    expect(user.tenantId).toBe('t-1')

    await ctx.kv.set('greeting', 'hello')
    expect(await ctx.kv.get('greeting')).toBe('hello')
    ctx.setCurrentUser({ id: 'u-2', tenantId: 't-2' })
    expect(await ctx.kv.get('greeting')).toBeNull()

    await ctx.db.insert('events', { userId: 'u-2', status: 'open', text: 'hello' })
    await ctx.db.insert('events', { userId: 'u-2', status: 'closed', text: 'done' })
    const events = await ctx.db.query('events').filter((q) => q.eq('status', 'open')).collect()
    expect(events).toHaveLength(1)
    const firstEvent = await ctx.db.query('events').withIndex('by_user', (q) => q.eq('userId', 'u-2')).first()
    expect(firstEvent).not.toBeNull()

    const job = await ctx.jobs.enqueue('bichat.worker.run', { x: 1 })
    expect(job.method).toBe('bichat.worker.run')
    const jobs = await ctx.jobs.list()
    expect(jobs.length).toBeGreaterThan(0)

    expect(await ctx.secrets.get('OPENAI_API_KEY')).toBe('secret')

    const stored = await ctx.files.store({
      name: 'note.txt',
      contentType: 'text/plain',
      data: new Uint8Array([104, 105]),
    })
    expect(stored.id).toBeTruthy()
    expect(await ctx.files.get(stored.id)).not.toBeNull()
    expect(await ctx.files.delete(stored.id)).toBeTrue()
    expect(await ctx.files.get(stored.id)).toBeNull()

    const echoed = await ctx.engine.call('bichat.custom.echo', { ping: true })
    expect(echoed.echoed.ping).toBeTrue()
  })
})

describe('schema helpers', () => {
  it('creates table definitions and indexes with zod shape', () => {
    const schema = defineSchema({
      users: defineTable({
        name: z.string(),
        managerId: id('users').optional(),
      }).index('by_manager', ['managerId']),
    })

    expect(schema.tables.users.indexes).toEqual([{ name: 'by_manager', fields: ['managerId'] }])
    const parsed = schema.tables.users.schema.parse({ name: 'Ali', managerId: 'u-1' })
    expect(parsed.name).toBe('Ali')
  })
})

