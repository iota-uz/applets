#!/usr/bin/env bun

const kvStore = new Map()
const dbStore = new Map()
const jobsStore = new Map()
const filesStore = new Map()
const deterministic = process.env.APPLET_DEV_DETERMINISTIC === '1'
let idCounter = 0

function nowISO() {
  return new Date().toISOString()
}

function randomID(prefix) {
  if (deterministic) {
    idCounter += 1
    return `${prefix}-${String(idCounter).padStart(6, '0')}`
  }
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
  const appletId = method.split('.')[0] || process.env.APPLET_DEV_APPLET_ID || 'applet'
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

function secretEnvKey(appletId, name) {
  const normalize = (input) =>
    String(input || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  return `IOTA_APPLET_SECRET_${normalize(appletId)}_${normalize(name)}`
}

function logRPC(method, status, startedAt) {
  const durationMs = Date.now() - startedAt
  console.log(
    JSON.stringify({
      level: 'info',
      ts: nowISO(),
      source: 'applet-dev',
      method,
      status,
      durationMs,
    }),
  )
}

function handleRPC(payload) {
  const id = payload.id ?? null
  const method = String(payload.method || '').trim()
  const params = payload.params || {}
  if (!method) {
    return rpcError(id, -32600, 'Invalid Request')
  }
  const scope = resolveScope(method)
  const parts = method.split('.')
  const namespace = parts.length >= 2 ? parts[1] : ''
  const op = parts.slice(2).join('.')

  if (method.endsWith('.auth.currentUser') || method === 'auth.currentUser') {
    return rpcResult(id, getUser())
  }

  if (namespace === 'kv') {
    if (op === 'get') {
      return rpcResult(id, kvStore.get(keyFor(scope, params.key)) ?? null)
    }
    if (op === 'set') {
      kvStore.set(keyFor(scope, params.key), params.value)
      return rpcResult(id, { ok: true })
    }
    if (op === 'del') {
      return rpcResult(id, kvStore.delete(keyFor(scope, params.key)))
    }
    if (op === 'mget') {
      const values = (params.keys || []).map((key) => kvStore.get(keyFor(scope, key)) ?? null)
      return rpcResult(id, values)
    }
  }

  if (namespace === 'db') {
    if (op === 'insert') {
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
    if (op === 'get') {
      return rpcResult(id, dbStore.get(keyFor(scope, params.id)) ?? null)
    }
    if (op === 'query') {
      const rows = [...dbStore.values()].filter((row) => row.table === params.table)
      return rpcResult(id, rows)
    }
    if (op === 'patch' || op === 'replace') {
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
    if (op === 'delete') {
      return rpcResult(id, dbStore.delete(keyFor(scope, params.id)))
    }
  }

  if (namespace === 'jobs') {
    if (op === 'enqueue') {
      const job = {
        id: randomID('job'),
        type: 'one_off',
        cron: '',
        method: String(params.method || ''),
        params: params.params || {},
        status: 'queued',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }
      jobsStore.set(keyFor(scope, job.id), job)
      return rpcResult(id, job)
    }
    if (op === 'schedule') {
      const job = {
        id: randomID('job'),
        type: 'scheduled',
        cron: String(params.cron || ''),
        method: String(params.method || ''),
        params: params.params || {},
        status: 'scheduled',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }
      jobsStore.set(keyFor(scope, job.id), job)
      return rpcResult(id, job)
    }
    if (op === 'list') {
      const prefix = `${scope.tenantId}::${scope.appletId}::`
      const jobs = [...jobsStore.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v)
      return rpcResult(id, jobs)
    }
    if (op === 'cancel') {
      return rpcResult(id, { ok: jobsStore.delete(keyFor(scope, params.id)) })
    }
  }

  if (namespace === 'secrets' && op === 'get') {
    const envKey = secretEnvKey(scope.appletId, params.name)
    const value = process.env[envKey]
    if (!value) {
      return rpcError(id, 'not_found', 'secret not found')
    }
    return rpcResult(id, { value })
  }

  if (namespace === 'files') {
    if (op === 'store') {
      const fileID = randomID('file')
      const record = {
        id: fileID,
        name: String(params.name || 'file.bin'),
        contentType: String(params.contentType || ''),
        size: Buffer.from(String(params.dataBase64 || ''), 'base64').byteLength,
        path: `/tmp/applet-dev/${scope.tenantId}/${scope.appletId}/${fileID}`,
        createdAt: nowISO(),
      }
      filesStore.set(keyFor(scope, fileID), record)
      return rpcResult(id, record)
    }
    if (op === 'get') {
      return rpcResult(id, filesStore.get(keyFor(scope, params.id)) ?? null)
    }
    if (op === 'delete') {
      return rpcResult(id, filesStore.delete(keyFor(scope, params.id)))
    }
  }

  if (namespace === 'ws' && op === 'send') {
    return rpcResult(id, { ok: true })
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
      const startedAt = Date.now()
      const payload = await request.json()
      if (Array.isArray(payload)) {
        const responses = payload.map((item) => {
          const method = String(item?.method || '').trim()
          const response = handleRPC(item)
          logRPC(method || '<invalid>', response.error ? 'error' : 'ok', startedAt)
          return response
        })
        return responseJSON(responses)
      }
      const method = String(payload?.method || '').trim()
      const response = handleRPC(payload)
      logRPC(method || '<invalid>', response.error ? 'error' : 'ok', startedAt)
      return responseJSON(response)
    }

    // Proxy all non-RPC requests to applet HTTP server with injected auth headers.
    const target = new URL(url.pathname + url.search, appletURL)
    const user = getUser()
    const headers = new Headers(request.headers)
    headers.set('x-iota-tenant-id', user.tenantId)
    headers.set('x-iota-user-id', user.id)
    headers.set('x-iota-permissions', user.permissions.join(','))
    headers.set('x-iota-request-id', user.requestId)

    const proxied = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: request.body,
      duplex: 'half',
    })
    return proxied
  },
})

console.log(`[applet-dev] listening on http://127.0.0.1:${port}`)
console.log(`[applet-dev] proxy target: ${appletURL}`)
