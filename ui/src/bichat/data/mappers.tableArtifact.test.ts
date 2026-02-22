import { describe, expect, it } from 'vitest'
import type { ConversationTurn, SessionArtifact } from '../types'
import { attachArtifactsToTurns } from './mappers'

describe('attachArtifactsToTurns table artifacts', () => {
  it('attaches table artifact metadata to assistant turn renderTables', () => {
    const assistantId = 'msg-assistant-1'
    const turns: ConversationTurn[] = [
      {
        id: 'turn-1',
        sessionId: 'session-1',
        createdAt: '2026-02-22T00:00:00.000Z',
        userTurn: {
          id: 'user-1',
          content: 'Show revenue',
          attachments: [],
          createdAt: '2026-02-22T00:00:00.000Z',
        },
        assistantTurn: {
          id: assistantId,
          role: 'assistant',
          content: 'Here is the table.',
          citations: [],
          artifacts: [],
          codeOutputs: [],
          lifecycle: 'complete',
          createdAt: '2026-02-22T00:00:01.000Z',
        },
      },
    ]

    const tableArtifact: SessionArtifact = {
      id: 'art-table-1',
      sessionId: 'session-1',
      messageId: assistantId,
      type: 'table',
      name: 'Revenue',
      sizeBytes: 0,
      createdAt: '2026-02-22T00:00:02.000Z',
      metadata: {
        query: 'SELECT * FROM revenue LIMIT 10',
        columns: ['region', 'amount'],
        headers: ['Region', 'Amount'],
        rows: [['North', 100], ['South', 200]],
        total_rows: 2,
        page_size: 25,
        truncated: false,
      },
    }

    const result = attachArtifactsToTurns(turns, [tableArtifact])
    expect(result).toHaveLength(1)
    const assistant = result[0]?.assistantTurn
    expect(assistant?.renderTables).toBeDefined()
    expect(assistant?.renderTables).toHaveLength(1)
    expect(assistant?.renderTables?.[0].query).toBe('SELECT * FROM revenue LIMIT 10')
    expect(assistant?.renderTables?.[0].columns).toEqual(['region', 'amount'])
    expect(assistant?.renderTables?.[0].headers).toEqual(['Region', 'Amount'])
    expect(assistant?.renderTables?.[0].totalRows).toBe(2)
  })

  it('dedupes table artifact against tool-call-derived renderTables', () => {
    const assistantId = 'msg-assistant-2'
    const turns: ConversationTurn[] = [
      {
        id: 'turn-2',
        sessionId: 'session-1',
        createdAt: '2026-02-22T00:00:00.000Z',
        userTurn: {
          id: 'user-2',
          content: 'Show table',
          attachments: [],
          createdAt: '2026-02-22T00:00:00.000Z',
        },
        assistantTurn: {
          id: assistantId,
          role: 'assistant',
          content: 'Done.',
          citations: [],
          artifacts: [],
          codeOutputs: [],
          lifecycle: 'complete',
          createdAt: '2026-02-22T00:00:01.000Z',
          toolCalls: [
            {
              id: 'tc-1',
              name: 'render_table',
              arguments: '{}',
              result: JSON.stringify({
                query: 'SELECT 1',
                columns: ['a'],
                headers: ['A'],
                rows: [[1]],
                total_rows: 1,
                page_size: 25,
                truncated: false,
              }),
            },
          ],
        },
      },
    ]

    const tableArtifact: SessionArtifact = {
      id: 'art-table-2',
      sessionId: 'session-1',
      messageId: assistantId,
      type: 'table',
      name: 'Table',
      sizeBytes: 0,
      createdAt: '2026-02-22T00:00:02.000Z',
      metadata: {
        query: 'SELECT 1',
        columns: ['a'],
        headers: ['A'],
        rows: [[1]],
        total_rows: 1,
        page_size: 25,
        truncated: false,
      },
    }

    const result = attachArtifactsToTurns(turns, [tableArtifact])
    expect(result).toHaveLength(1)
    const assistant = result[0]?.assistantTurn
    expect(assistant?.renderTables).toHaveLength(1)
  })
})
