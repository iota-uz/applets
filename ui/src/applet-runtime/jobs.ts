import { engine } from './engine'

export type ScheduledJob = {
  id: string
  type: string
  cron: string
  method: string
  params: unknown
  status: string
  createdAt?: string
  updatedAt?: string
}

function appletMethod(op: string): string {
  const appletID = process.env.IOTA_APPLET_ID
  if (!appletID || appletID.trim() === '') {
    throw new Error('IOTA_APPLET_ID is required')
  }
  return `${appletID}.jobs.${op}`
}

export const jobs = {
  enqueue(method: string, params?: unknown): Promise<ScheduledJob> {
    return engine.call<ScheduledJob>(appletMethod('enqueue'), { method, params: params ?? {} })
  },
  schedule(cron: string, method: string, params?: unknown): Promise<ScheduledJob> {
    return engine.call<ScheduledJob>(appletMethod('schedule'), { cron, method, params: params ?? {} })
  },
  list(): Promise<ScheduledJob[]> {
    return engine.call<ScheduledJob[]>(appletMethod('list'), {})
  },
  cancel(id: string): Promise<{ ok: boolean }> {
    return engine.call<{ ok: boolean }>(appletMethod('cancel'), { id })
  },
}
