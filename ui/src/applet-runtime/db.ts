import { engine } from './engine'

type Query = Record<string, unknown>

function appletMethod(op: string): string {
  const appletID = process.env.IOTA_APPLET_ID
  if (!appletID || appletID.trim() === '') {
    throw new Error('IOTA_APPLET_ID is required')
  }
  return `${appletID}.db.${op}`
}

export const db = {
  get<T = unknown>(id: string): Promise<T | null> {
    return engine.call<T | null>(appletMethod('get'), { id })
  },
  query<T = unknown>(table: string, query?: Query): Promise<T[]> {
    return engine.call<T[]>(appletMethod('query'), { table, query: query ?? {} })
  },
  insert<T = unknown>(table: string, value: unknown): Promise<T> {
    return engine.call<T>(appletMethod('insert'), { table, value })
  },
  patch<T = unknown>(id: string, value: unknown): Promise<T> {
    return engine.call<T>(appletMethod('patch'), { id, value })
  },
  replace<T = unknown>(id: string, value: unknown): Promise<T> {
    return engine.call<T>(appletMethod('replace'), { id, value })
  },
  delete(id: string): Promise<boolean> {
    return engine.call<boolean>(appletMethod('delete'), { id })
  },
}

