import { describe, expect, it } from 'vitest';
import { sanitizePendingQuestion } from './mappers';

describe('sanitizePendingQuestion', () => {
  it('keeps option ids as answer values', () => {
    const pending = sanitizePendingQuestion(
      {
        checkpointId: 'cp-1',
        turnId: 'turn-1',
        agentName: 'ali',
        questions: [
          {
            id: 'scope',
            text: 'Scope?',
            type: 'single_choice',
            options: [
              { id: 'sold', label: 'Sold only' },
              { id: 'all', label: 'All policies' },
            ],
          },
        ],
      },
      'session-1',
    );

    expect(pending).not.toBeNull();
    expect(pending?.questions[0]?.options?.[0]?.value).toBe('sold');
    expect(pending?.questions[0]?.options?.[1]?.value).toBe('all');
  });
});
