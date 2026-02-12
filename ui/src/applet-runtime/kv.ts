import { engine } from './engine'

function appletMethod(op: string): string {
  const appletID = process.env.IOTA_APPLET_ID
  if (!appletID || appletID.trim() === '') {
    throw new Error('IOTA_APPLET_ID is required')
  }
  return `${appletID}.kv.${op}`
}

export const kv = {
  get<T = unknown>(key: string): Promise<T | null> {
    return engine.call<T | null>(appletMethod('get'), { key })
  },
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    return engine.call<void>(appletMethod('set'), { key, value, ttlSeconds })
  },
  del(key: string): Promise<boolean> {
    return engine.call<boolean>(appletMethod('del'), { key })
  },
  mget<T = unknown>(keys: string[]): Promise<Array<T | null>> {
    return engine.call<Array<T | null>>(appletMethod('mget'), { keys })
  },
}

