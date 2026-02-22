// @ts-nocheck
import { describe, expect, it } from 'bun:test';

import { dispatchBridgeEvent, ws } from './ws';

describe('ws bridge handlers', () => {
  it('dispatches open/message/close events to subscribed handlers', async () => {
    const events: string[] = [];
    const unsubOpen = ws.onConnection((id) => events.push(`open:${id}`));
    const unsubMessage = ws.onMessage((id, data) => events.push(`message:${id}:${Buffer.from(data).toString('utf8')}`));
    const unsubClose = ws.onClose((id) => events.push(`close:${id}`));

    await dispatchBridgeEvent({ connectionId: 'c1', event: 'open' });
    await dispatchBridgeEvent({
      connectionId: 'c1',
      event: 'message',
      dataBase64: Buffer.from('hello').toString('base64'),
    });
    await dispatchBridgeEvent({ connectionId: 'c1', event: 'close' });

    unsubOpen();
    unsubMessage();
    unsubClose();

    expect(events).toEqual(['open:c1', 'message:c1:hello', 'close:c1']);
  });
});

