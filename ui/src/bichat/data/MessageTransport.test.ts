import { afterEach, describe, expect, it, vi } from 'vitest';
import { resumeStream, sendMessage, type MessageTransportDeps } from './MessageTransport';

const encoder = new TextEncoder();

function createSSEStream(events: Array<Record<string, unknown>>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}

function createDeps(overrides: Partial<MessageTransportDeps> = {}): MessageTransportDeps {
  return {
    callRPC: vi.fn(async () => {
      throw new Error('callRPC should not be used in this test');
    }),
    baseUrl: '',
    streamEndpoint: '/stream',
    rpcTimeoutMs: 120_000,
    createHeaders: () => new Headers(),
    uploadFileFn: vi.fn(async () => {
      throw new Error('uploadFileFn should not be used in this test');
    }),
    logAttachmentLifecycle: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MessageTransport stream timeout defaults', () => {
  it('does not schedule a send timeout when streamConnectTimeoutMs is omitted', async () => {
    const fetchMock = vi.fn(async () => new Response(
      createSSEStream([{ type: 'done' }]),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));
    vi.stubGlobal('fetch', fetchMock);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const chunks = [];
    for await (const chunk of sendMessage(
      createDeps(),
      'session-1',
      'hello world',
      [],
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ type: 'done' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('does not schedule a resume timeout when connectTimeoutMs is omitted', async () => {
    const fetchMock = vi.fn(async () => new Response(
      createSSEStream([{ type: 'done' }]),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));
    vi.stubGlobal('fetch', fetchMock);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const chunks: Array<{ type?: string }> = [];
    await resumeStream(
      {
        baseUrl: '',
        streamEndpoint: '/stream',
        createHeaders: () => new Headers(),
      },
      'session-1',
      'run-1',
      (chunk) => {
        chunks.push({ type: chunk.type });
      },
    );

    expect(chunks).toEqual([{ type: 'done' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
