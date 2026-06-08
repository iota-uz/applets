import { beforeEach, describe, expect, it } from 'vitest';
import type {
  Attachment,
  ChatDataSource,
  SendMessageOptions,
  Session,
  StreamChunk,
} from '../types';
import type { RateLimiter } from '../utils/RateLimiter';
import { ChatMachine } from './ChatMachine';

const SESSION_ID = 'session-1';

function makeSession(id: string): Session {
  const now = new Date().toISOString();
  return {
    id,
    title: 'Test session',
    status: 'active',
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createMemorySessionStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function installWindowWithSessionStorage(): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      sessionStorage: createMemorySessionStorage(),
      dispatchEvent: () => true,
    },
    configurable: true,
    writable: true,
  });
}

const rateLimiter = {
  canMakeRequest: () => true,
  getTimeUntilNextRequest: () => 0,
} as unknown as RateLimiter;

function makeDataSource(
  sendImpl: (
    sessionId: string,
    content: string,
    attachments?: Attachment[],
    signal?: AbortSignal,
    options?: SendMessageOptions,
  ) => AsyncGenerator<StreamChunk>,
): ChatDataSource {
  return {
    createSession: async () => makeSession(SESSION_ID),
    fetchSession: async (id: string) => ({
      session: makeSession(id),
      turns: [],
      pendingQuestion: null,
    }),
    sendMessage: sendImpl,
  } as unknown as ChatDataSource;
}

describe('ChatMachine send error handling', () => {
  beforeEach(() => {
    installWindowWithSessionStorage();
  });

  it('restores the typed prompt and shows a banner on a genuine stream error', async () => {
    // The answer streams partially, then a terminal error arrives. The send
    // must fail non-destructively: the optimistic turn is removed, the user's
    // prompt is returned to the input (never silently lost), and a retryable
    // banner is shown.
    const dataSource = makeDataSource(async function* () {
      yield { type: 'content', content: 'Partial answer' } as StreamChunk;
      yield { type: 'error', error: 'boom' } as StreamChunk;
    });
    const machine = new ChatMachine({ dataSource, rateLimiter });
    machine.setSessionId(SESSION_ID);

    await machine.sendMessage('Hello world');

    const input = machine.getInputSnapshot();
    const messaging = machine.getMessagingSnapshot();
    expect(input.message).toBe('Hello world');
    expect(messaging.streamError).toBeTruthy();
    expect(messaging.turns).toHaveLength(0);
  });

  it('restores the prompt without an error banner when the stream is aborted', async () => {
    // A user stop / unmount surfaces as a real AbortError (see
    // MessageTransport): the machine takes the soft-cancel path — prompt
    // restored, no error banner.
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const dataSource = makeDataSource(async function* () {
      yield { type: 'content', content: 'Partial' } as StreamChunk;
      throw abortError;
    });
    const machine = new ChatMachine({ dataSource, rateLimiter });
    machine.setSessionId(SESSION_ID);

    await machine.sendMessage('Hello again');

    const input = machine.getInputSnapshot();
    const messaging = machine.getMessagingSnapshot();
    expect(input.message).toBe('Hello again');
    expect(messaging.streamError).toBeNull();
  });
});
