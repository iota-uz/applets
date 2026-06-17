/**
 * Dev-only harness for manually exercising ChatMachine lifecycle behaviour in a
 * real browser (session switch mid-stream, queue drain, stream error). Not a
 * visual/CI story — it drives the real ChatSession + ChatMachine against a
 * scripted mock so the async paths can be poked by hand (or by Chrome MCP).
 */
import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ChatSession } from './ChatSession';
import { MockChatDataSource } from '@sb-helpers/mockChatDataSource';
import {
  makeSession,
  makeConversationTurn,
  makeUserTurn,
  makeAssistantTurn,
} from '@sb-helpers/bichatFixtures';
import type { StreamChunk } from '../types';

const WORD_DELAY_MS = 130;

/** Scripted data source: per-session history, slow streaming, on-demand error. */
class HarnessDataSource extends MockChatDataSource {
  shouldError = false;

  constructor() {
    super({ streamingDelay: WORD_DELAY_MS });
  }

  async fetchSession(id: string) {
    return {
      session: makeSession({ id, title: `Session ${id}` }),
      turns: [
        makeConversationTurn({
          id: `${id}-history`,
          userTurn: makeUserTurn({ content: `(${id}) earlier question` }),
          assistantTurn: makeAssistantTurn({
            content: `Persisted history for session ${id}.`,
          }),
        }),
      ],
      pendingQuestion: null,
    };
  }

  async *sendMessage(
    sessionId: string,
    content: string,
  ): AsyncGenerator<StreamChunk> {
    yield { type: 'user_message', sessionId } as StreamChunk;
    const words = [
      `Streaming reply for ${sessionId} →`,
      `"${content}".`,
      ...Array.from({ length: 36 }, (_, i) => `word${i}`),
    ];
    for (const word of words) {
      await new Promise((r) => setTimeout(r, WORD_DELAY_MS));
      if (this.shouldError) {
        this.shouldError = false;
        yield { type: 'error', error: 'Injected stream failure' } as StreamChunk;
        return;
      }
      yield { type: 'chunk', content: word + ' ' } as StreamChunk;
    }
    yield { type: 'done', sessionId } as StreamChunk;
  }
}

function Harness() {
  const ds = useMemo(() => new HarnessDataSource(), []);
  const [sessionId, setSessionId] = useState('A');

  const btn =
    'rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-50';

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-100 p-2">
        <button className={btn} data-testid="go-A" onClick={() => setSessionId('A')}>
          Session A
        </button>
        <button className={btn} data-testid="go-B" onClick={() => setSessionId('B')}>
          Session B
        </button>
        <button
          className={btn}
          data-testid="err-next"
          onClick={() => {
            ds.shouldError = true;
          }}
        >
          Error next send
        </button>
        <span className="ml-2 text-sm text-gray-600" data-testid="active-session">
          active: {sessionId}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ChatSession dataSource={ds} sessionId={sessionId} />
      </div>
    </div>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'BiChat/Dev/Lifecycle Harness',
  component: Harness,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Harness>

export const Playground: Story = {};
