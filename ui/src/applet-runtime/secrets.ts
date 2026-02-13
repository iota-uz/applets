import { engine } from './engine'

function appletMethod(op: string): string {
  const appletID = process.env.IOTA_APPLET_ID
  if (!appletID || appletID.trim() === '') {
    throw new Error('IOTA_APPLET_ID is required')
  }
  return `${appletID}.secrets.${op}`
}

export const secrets = {
  async get(name: string): Promise<string> {
    const response = await engine.call<{ value: string }>(appletMethod('get'), { name })
    return response.value
  },
}
