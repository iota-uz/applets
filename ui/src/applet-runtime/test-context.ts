import { type CurrentUser } from './auth'
import { createDB, type DBConstraint, type DBQueryOptions } from './db'
import { type ScheduledJob } from './jobs'
import { type StoredFile } from './files'

type EngineHandler = (params: unknown) => unknown | Promise<unknown>

export type TestContextOptions = {
  appletId?: string
  user?: Partial<CurrentUser>
  secrets?: Record<string, string>
  engineHandlers?: Record<string, EngineHandler>
}

type TestDocument = {
  id: string
  table: string
  value: unknown
  createdAt: number
  updatedAt: number
}

type TestFileRecord = StoredFile & {
  dataBase64: string
}

const defaultUser: CurrentUser = {
  id: 'test-user',
  tenantId: 'test-tenant',
  permissions: [],
}

function normalizeUser(user?: Partial<CurrentUser>): CurrentUser {
  return {
    ...defaultUser,
    ...(user ?? {}),
    permissions: user?.permissions ? [...user.permissions] : [],
  }
}

function randomID(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  return Number.NaN
}

function nestedValue(input: unknown, field: string): unknown {
  let current: unknown = input
  for (const segment of field.split('.')) {
    if (!current || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function matchesConstraint(value: unknown, constraint: DBConstraint): boolean {
  if (constraint.op !== 'eq') {
    return false
  }
  return String(nestedValue(value, constraint.field)) === String(constraint.value)
}

function filterDocuments(documents: TestDocument[], options: DBQueryOptions): TestDocument[] {
  let result = [...documents]
  if (options.index) {
    result = result.filter((doc) => matchesConstraint(doc.value, options.index!))
  }
  for (const filter of options.filters ?? []) {
    result = result.filter((doc) => matchesConstraint(doc.value, filter))
  }
  result.sort((a, b) => (options.order === 'asc' ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt))
  if (typeof options.take === 'number' && options.take > 0) {
    result = result.slice(0, options.take)
  }
  return result
}

function parseBase64Payload(data: unknown): string {
  if (typeof data !== 'string' || data.trim() === '') {
    throw new Error('dataBase64 is required')
  }
  return data
}

async function toBase64(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  if (data instanceof Blob) {
    const buffer = await data.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('base64')
  }
  return Buffer.from(data).toString('base64')
}

export function createTestContext(options: TestContextOptions = {}) {
  const appletId = options.appletId?.trim() || 'test'
  let currentUser = normalizeUser(options.user)
  const customHandlers = options.engineHandlers ?? {}
  const secretStore = new Map(Object.entries(options.secrets ?? {}))
  const kvStore = new Map<string, unknown>()
  const dbStore = new Map<string, TestDocument>()
  const jobsStore = new Map<string, ScheduledJob>()
  const filesStore = new Map<string, TestFileRecord>()

  function scopedKey(key: string): string {
    return `${currentUser.tenantId}::${appletId}::${key}`
  }

  async function dbCall<T>(op: string, params: Record<string, unknown>): Promise<T> {
    switch (op) {
      case 'get': {
        const id = String(params.id ?? '')
        const record = dbStore.get(id)
        return (record ? { _id: record.id, table: record.table, value: record.value } : null) as T
      }
      case 'query': {
        const table = String(params.table ?? '')
        const query = (params.query as DBQueryOptions | undefined) ?? {}
        const rows = filterDocuments(
          [...dbStore.values()].filter((doc) => doc.table === table),
          query,
        )
        return rows.map((doc) => ({ _id: doc.id, table: doc.table, value: doc.value })) as T
      }
      case 'insert': {
        const id = randomID('doc')
        const now = Date.now()
        const record: TestDocument = {
          id,
          table: String(params.table ?? ''),
          value: params.value,
          createdAt: now,
          updatedAt: now,
        }
        dbStore.set(id, record)
        return { _id: id, table: record.table, value: record.value } as T
      }
      case 'patch':
      case 'replace': {
        const id = String(params.id ?? '')
        const current = dbStore.get(id)
        if (!current) {
          return null as T
        }
        const next: TestDocument = {
          ...current,
          value: params.value,
          updatedAt: Date.now(),
        }
        dbStore.set(id, next)
        return { _id: id, table: next.table, value: next.value } as T
      }
      case 'delete': {
        const id = String(params.id ?? '')
        return dbStore.delete(id) as T
      }
      default:
        throw new Error(`unknown db op: ${op}`)
    }
  }

  const db = createDB((op, params) => dbCall(op, params))

  const engine = {
    async call<T = unknown>(method: string, params: unknown): Promise<T> {
      if (customHandlers[method]) {
        return (await customHandlers[method](params)) as T
      }

      const chunks = method.split('.')
      if (chunks.length < 3 || chunks[0] !== appletId) {
        throw new Error(`unsupported method: ${method}`)
      }
      const namespace = chunks[1]
      const op = chunks.slice(2).join('.')
      const payload = (params as Record<string, unknown>) ?? {}

      if (namespace === 'kv') {
        const key = String(payload.key ?? '')
        const storageKey = scopedKey(key)
        if (op === 'get') {
          return (kvStore.get(storageKey) ?? null) as T
        }
        if (op === 'set') {
          kvStore.set(storageKey, payload.value)
          return undefined as T
        }
        if (op === 'del') {
          return kvStore.delete(storageKey) as T
        }
        if (op === 'mget') {
          const keys = Array.isArray(payload.keys) ? payload.keys.map((v) => String(v)) : []
          return keys.map((k) => kvStore.get(scopedKey(k)) ?? null) as T
        }
      }

      if (namespace === 'db') {
        return dbCall(op, payload) as Promise<T>
      }

      if (namespace === 'jobs') {
        if (op === 'enqueue') {
          const id = randomID('job')
          const record: ScheduledJob = {
            id,
            type: 'one_off',
            cron: '',
            method: String(payload.method ?? ''),
            params: payload.params ?? {},
            status: 'queued',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          jobsStore.set(id, record)
          return record as T
        }
        if (op === 'schedule') {
          const id = randomID('job')
          const record: ScheduledJob = {
            id,
            type: 'scheduled',
            cron: String(payload.cron ?? ''),
            method: String(payload.method ?? ''),
            params: payload.params ?? {},
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          jobsStore.set(id, record)
          return record as T
        }
        if (op === 'list') {
          return [...jobsStore.values()] as T
        }
        if (op === 'cancel') {
          const id = String(payload.id ?? '')
          return { ok: jobsStore.delete(id) } as T
        }
      }

      if (namespace === 'secrets' && op === 'get') {
        const name = String(payload.name ?? '')
        const value = secretStore.get(name)
        if (value === undefined) {
          throw new Error(`secret not found: ${name}`)
        }
        return { value } as T
      }

      if (namespace === 'files') {
        if (op === 'store') {
          const id = randomID('file')
          const name = String(payload.name ?? 'file.bin')
          const dataBase64 = parseBase64Payload(payload.dataBase64)
          const contentType = String(payload.contentType ?? '')
          const size = Buffer.from(dataBase64, 'base64').byteLength
          const record: TestFileRecord = {
            id,
            name,
            contentType,
            size,
            path: `/test/${currentUser.tenantId}/${appletId}/${id}-${name}`,
            createdAt: new Date().toISOString(),
            dataBase64,
          }
          filesStore.set(id, record)
          return record as T
        }
        if (op === 'get') {
          const id = String(payload.id ?? '')
          const record = filesStore.get(id)
          if (!record) {
            return null as T
          }
          const { dataBase64: _, ...rest } = record
          return rest as T
        }
        if (op === 'delete') {
          const id = String(payload.id ?? '')
          return filesStore.delete(id) as T
        }
      }

      throw new Error(`unsupported method: ${method}`)
    },
  }

  return {
    auth: {
      async currentUser(): Promise<CurrentUser> {
        return currentUser
      },
    },
    engine,
    kv: {
      async get<T = unknown>(key: string): Promise<T | null> {
        return (kvStore.get(scopedKey(key)) ?? null) as T | null
      },
      async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
        if (!Number.isNaN(toNumber(ttlSeconds)) && (ttlSeconds as number) <= 0) {
          kvStore.delete(scopedKey(key))
          return
        }
        kvStore.set(scopedKey(key), value)
      },
      async del(key: string): Promise<boolean> {
        return kvStore.delete(scopedKey(key))
      },
      async mget<T = unknown>(keys: string[]): Promise<Array<T | null>> {
        return keys.map((key) => (kvStore.get(scopedKey(key)) ?? null) as T | null)
      },
    },
    db,
    jobs: {
      enqueue(method: string, params?: unknown): Promise<ScheduledJob> {
        return engine.call(`${appletId}.jobs.enqueue`, { method, params: params ?? {} })
      },
      schedule(cron: string, method: string, params?: unknown): Promise<ScheduledJob> {
        return engine.call(`${appletId}.jobs.schedule`, { cron, method, params: params ?? {} })
      },
      list(): Promise<ScheduledJob[]> {
        return engine.call(`${appletId}.jobs.list`, {})
      },
      cancel(id: string): Promise<{ ok: boolean }> {
        return engine.call(`${appletId}.jobs.cancel`, { id })
      },
    },
    secrets: {
      async get(name: string): Promise<string> {
        const result = await engine.call<{ value: string }>(`${appletId}.secrets.get`, { name })
        return result.value
      },
    },
    files: {
      async store(input: { name: string; contentType?: string; data: Blob | ArrayBuffer | Uint8Array }): Promise<StoredFile> {
        const dataBase64 = await toBase64(input.data)
        return engine.call<StoredFile>(`${appletId}.files.store`, {
          name: input.name,
          contentType: input.contentType ?? '',
          dataBase64,
        })
      },
      get(id: string): Promise<StoredFile | null> {
        return engine.call(`${appletId}.files.get`, { id })
      },
      delete(id: string): Promise<boolean> {
        return engine.call(`${appletId}.files.delete`, { id })
      },
    },
    setCurrentUser(nextUser: Partial<CurrentUser>) {
      currentUser = normalizeUser(nextUser)
    },
  }
}

