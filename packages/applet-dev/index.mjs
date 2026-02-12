#!/usr/bin/env bun

const kvStore = new Map()
const dbStore = new Map()

function nowISO() {
  return new Date().toISOString()
}

function randomID(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getUser() {
  return {
    id: process.env.APPLET_DEV_USER_ID || 'dev-user',
    tenantId: process.env.APPLET_DEV_TENANT_ID || 'dev-tenant',
    permissions: (process.env.APPLET_DEV_PERMISSIONS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    requestId: randomID('req'),
  }
}

function responseJSON(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function resolveScope(method) {
  const appletId = method.split('.')[0] || 'applet'
  const tenantId = process.env.APPLET_DEV_TENANT_ID || 'dev-tenant'
  return { appletId, tenantId }
}

function keyFor(scope, key) {
  return `${scope.tenantId}::${scope.appletId}::${key}`
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

function handleRPC(payload) {
  const id = payload.id ?? null
  const method = String(payload.method || '')
  const params = payload.params || {}
  if (!method) {
    return rpcError(id, -32600, 'Invalid Request')
  }
  const scope = resolveScope(method)

  if (method.endsWith('.auth.currentUser') || method === 'auth.currentUser') {
    return rpcResult(id, getUser())
  }
  if (method.endsWith('.kv.get')) {
    return rpcResult(id, kvStore.get(keyFor(scope, params.key)) ?? null)
  }
  if (method.endsWith('.kv.set')) {
    kvStore.set(keyFor(scope, params.key), params.value)
    return rpcResult(id, { ok: true })
  }
  if (method.endsWith('.kv.del')) {
    return rpcResult(id, kvStore.delete(keyFor(scope, params.key)))
  }
  if (method.endsWith('.kv.mget')) {
    const values = (params.keys || []).map((key) => kvStore.get(keyFor(scope, key)) ?? null)
    return rpcResult(id, values)
  }
  if (method.endsWith('.db.insert')) {
    const idValue = randomID('doc')
    const record = {
      _id: idValue,
      table: params.table,
      value: params.value,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    dbStore.set(keyFor(scope, idValue), record)
    return rpcResult(id, record)
  }
  if (method.endsWith('.db.get')) {
    return rpcResult(id, dbStore.get(keyFor(scope, params.id)) ?? null)
  }
  if (method.endsWith('.db.query')) {
    const rows = [...dbStore.values()].filter((row) => row.table === params.table)
    return rpcResult(id, rows)
  }
  if (method.endsWith('.db.patch') || method.endsWith('.db.replace')) {
    const key = keyFor(scope, params.id)
    const existing = dbStore.get(key)
    if (!existing) {
      return rpcResult(id, null)
    }
    const updated = {
      ...existing,
      value: params.value,
      updatedAt: nowISO(),
    }
    dbStore.set(key, updated)
    return rpcResult(id, updated)
  }
  if (method.endsWith('.db.delete')) {
    return rpcResult(id, dbStore.delete(keyFor(scope, params.id)))
  }

  return rpcError(id, -32601, 'Method not found')
}

const appletURL = process.env.APPLET_DEV_APPLET_URL || 'http://127.0.0.1:3301'
const port = Number(process.env.APPLET_DEV_PORT || '3760')

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/rpc' && request.method === 'POST') {
      const payload = await request.json()
      if (Array.isArray(payload)) {
        return responseJSON(payload.map((item) => handleRPC(item)))
      }
      return responseJSON(handleRPC(payload))
    }

    // Proxy all other HTTP requests to the applet process for local integration.
    const target = new URL(url.pathname + url.search, appletURL)
    const proxied = await fetch(target.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half',
    })
    return proxied
  },
})

console.log(`[applet-dev] listening on http://127.0.0.1:${port}`)
console.log(`[applet-dev] proxy target: ${appletURL}`)
