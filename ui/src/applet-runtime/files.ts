import { engine } from './engine'

export type StoredFile = {
  id: string
  name: string
  contentType?: string
  size: number
  path: string
  createdAt: string
}

function appletMethod(op: string): string {
  const appletID = process.env.IOTA_APPLET_ID
  if (!appletID || appletID.trim() === '') {
    throw new Error('IOTA_APPLET_ID is required')
  }
  return `${appletID}.files.${op}`
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

export const files = {
  async store(input: {
    name: string
    contentType?: string
    data: Blob | ArrayBuffer | Uint8Array
  }): Promise<StoredFile> {
    const dataBase64 = await toBase64(input.data)
    return engine.call<StoredFile>(appletMethod('store'), {
      name: input.name,
      contentType: input.contentType ?? '',
      dataBase64,
    })
  },
  get(id: string): Promise<StoredFile | null> {
    return engine.call<StoredFile | null>(appletMethod('get'), { id })
  },
  delete(id: string): Promise<boolean> {
    return engine.call<boolean>(appletMethod('delete'), { id })
  },
}
