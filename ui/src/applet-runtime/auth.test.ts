// @ts-nocheck
import { describe, expect, it } from 'bun:test'

import { auth } from './auth'
import { withRequestContext } from './context'

describe('auth.currentUser', () => {
  it('reads user context from request headers', async () => {
    const request = new Request('http://localhost/__probe', {
      headers: {
        'x-iota-user-id': 'user-1',
        'x-iota-tenant-id': 'tenant-1',
        'x-iota-permissions': 'BiChat.Access,BiChat.Write',
        'x-iota-request-id': 'req-1',
      },
    })

    const user = await withRequestContext(request, () => auth.currentUser())
    expect(user).toEqual({
      id: 'user-1',
      tenantId: 'tenant-1',
      permissions: ['BiChat.Access', 'BiChat.Write'],
      requestId: 'req-1',
    })
  })
})
