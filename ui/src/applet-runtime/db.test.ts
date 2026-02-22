// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { db } from './db';

describe('db query builder', () => {
  const originalFetch = globalThis.fetch;
  const originalAppletID = process.env.IOTA_APPLET_ID;
  const originalSocket = process.env.IOTA_ENGINE_SOCKET;

  beforeEach(() => {
    process.env.IOTA_APPLET_ID = 'bichat';
    process.env.IOTA_ENGINE_SOCKET = '/tmp/iota-engine.sock';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.IOTA_APPLET_ID = originalAppletID;
    process.env.IOTA_ENGINE_SOCKET = originalSocket;
  });

  it('maps builder chain to db.query payload', async () => {
    const calls: any[] = [];
    globalThis.fetch = mock(async (_url: string, init: any) => {
      const body = JSON.parse(String(init.body));
      calls.push(body);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: [{ _id: '1' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const rows = await db
      .query('events')
      .withIndex('by_user', (q) => q.eq('userId', 'u-1'))
      .filter((q) => q.eq('status', 'open'))
      .order('asc')
      .take(5)
      .collect();
    expect(rows).toHaveLength(1);

    const first = await db
      .query('events')
      .filter((q) => q.eq('status', 'open'))
      .first();
    expect(first?._id).toBe('1');

    expect(calls[0].method).toBe('bichat.db.query');
    expect(calls[0].params.query).toEqual({
      index: { name: 'by_user', field: 'userId', op: 'eq', value: 'u-1' },
      filters: [{ field: 'status', op: 'eq', value: 'open' }],
      order: 'asc',
      take: 5,
    });
    expect(calls[1].params.query.take).toBe(1);
  });
});

