import { engine } from './engine';

type ConnectionHandler = (connectionId: string) => void | Promise<void>
type MessageHandler = (connectionId: string, data: Uint8Array) => void | Promise<void>
type CloseHandler = (connectionId: string) => void | Promise<void>

type BridgeEventPayload = {
  connectionId: string
  event: 'open' | 'message' | 'close'
  dataBase64?: string
}

const connectionHandlers = new Set<ConnectionHandler>();
const messageHandlers = new Set<MessageHandler>();
const closeHandlers = new Set<CloseHandler>();

function appletMethod(op: string): string {
  const appletID = process.env.IOTA_APPLET_ID;
  if (!appletID || appletID.trim() === '') {
    throw new Error('IOTA_APPLET_ID is required');
  }
  return `${appletID}.ws.${op}`;
}

async function runHandlers<T>(handlers: Set<(value: T) => void | Promise<void>>, value: T): Promise<void> {
  for (const handler of handlers) {
    await handler(value);
  }
}

async function runMessageHandlers(connectionId: string, data: Uint8Array): Promise<void> {
  for (const handler of messageHandlers) {
    await handler(connectionId, data);
  }
}

export async function dispatchBridgeEvent(payload: BridgeEventPayload): Promise<void> {
  if (payload.event === 'open') {
    await runHandlers(connectionHandlers, payload.connectionId);
    return;
  }
  if (payload.event === 'close') {
    await runHandlers(closeHandlers, payload.connectionId);
    return;
  }
  if (payload.event === 'message') {
    const decoded = Buffer.from(payload.dataBase64 ?? '', 'base64');
    await runMessageHandlers(payload.connectionId, new Uint8Array(decoded));
  }
}

export const ws = {
  async send(connectionId: string, data: unknown): Promise<{ ok: boolean }> {
    return engine.call<{ ok: boolean }>(appletMethod('send'), { connectionId, data });
  },
  onConnection(handler: ConnectionHandler): () => void {
    connectionHandlers.add(handler);
    return () => connectionHandlers.delete(handler);
  },
  onMessage(handler: MessageHandler): () => void {
    messageHandlers.add(handler);
    return () => messageHandlers.delete(handler);
  },
  onClose(handler: CloseHandler): () => void {
    closeHandlers.add(handler);
    return () => closeHandlers.delete(handler);
  },
};

