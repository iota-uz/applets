import type {
  ChatDataSource,
  Session,
  SessionListResult,
  SessionUser,
  ConversationTurn,
  PendingQuestion,
  StreamChunk,
  QuestionAnswers,
  SendMessageOptions,
} from '../../src/bichat/types'
import { makeSession, makeSessions, makeSessionUser } from './bichatFixtures'

export class MockChatDataSource implements ChatDataSource {
  constructor(
    private options: {
      session?: Session
      sessions?: Session[]
      users?: SessionUser[]
      turns?: ConversationTurn[]
      pendingQuestion?: PendingQuestion | null
      streamingDelay?: number
    } = {}
  ) {}

  async createSession(): Promise<Session> {
    return this.options.session ?? makeSession()
  }

  async fetchSession(id: string): Promise<{
    session: Session
    turns: ConversationTurn[]
    pendingQuestion?: PendingQuestion | null
  } | null> {
    return {
      session: this.options.session ?? makeSession({ id }),
      turns: this.options.turns ?? [],
      pendingQuestion: this.options.pendingQuestion,
    }
  }

  async *sendMessage(
    _sessionId: string,
    content: string,
    _attachments = [],
    _signal?: AbortSignal,
    _options?: SendMessageOptions
  ): AsyncGenerator<StreamChunk> {
    // 1. Signal user message accepted
    yield { type: 'user_message', sessionId: _sessionId }

    // 2. Simulate streaming chunks
    const response = `You said: "${content}". This is a mock response from Storybook.`
    const words = response.split(' ')

    for (const word of words) {
      if (this.options.streamingDelay) {
        await new Promise((resolve) => setTimeout(resolve, this.options.streamingDelay))
      }
      yield { type: 'chunk', content: word + ' ' }
    }

    // 3. Signal done
    yield { type: 'done', sessionId: _sessionId }
  }

  async clearSessionHistory(_sessionId: string): Promise<{ success: boolean; deletedMessages: number; deletedArtifacts: number }> {
    return { success: true, deletedMessages: 0, deletedArtifacts: 0 }
  }

  async compactSessionHistory(_sessionId: string): Promise<{ success: boolean; summary: string; deletedMessages: number; deletedArtifacts: number }> {
    return { success: true, summary: 'Compacted summary', deletedMessages: 0, deletedArtifacts: 0 }
  }

  async submitQuestionAnswers(
    _sessionId: string,
    _questionId: string,
    _answers: QuestionAnswers
  ): Promise<{ success: boolean; error?: string }> {
    console.log('Mock submit answers:', _answers)
    return { success: true }
  }

  async rejectPendingQuestion(_questionId: string): Promise<{ success: boolean; error?: string }> {
    console.log('Mock reject question:', _questionId)
    return { success: true }
  }

  navigateToSession(sessionId: string): void {
    console.log('Mock navigate to session:', sessionId)
  }

  // Session management
  async listSessions(opts?: {
    limit?: number
    offset?: number
    includeArchived?: boolean
  }): Promise<SessionListResult> {
    const all = this.options.sessions ?? makeSessions()
    const filtered = opts?.includeArchived
      ? all
      : all.filter((s) => s.status === 'active')
    const offset = opts?.offset ?? 0
    const limit = opts?.limit ?? 50
    const slice = filtered.slice(offset, offset + limit)
    return { sessions: slice, total: filtered.length, hasMore: offset + limit < filtered.length }
  }

  async listUsers(): Promise<SessionUser[]> {
    return this.options.users ?? [
      makeSessionUser({ id: 'u-1', firstName: 'Alice', lastName: 'Smith', initials: 'AS' }),
      makeSessionUser({ id: 'u-2', firstName: 'Bob', lastName: 'Johnson', initials: 'BJ' }),
    ]
  }

  async listAllSessions(opts?: {
    limit?: number
    offset?: number
    includeArchived?: boolean
    userId?: string | null
  }): Promise<{
    sessions: Array<Session & { owner: SessionUser }>
    total: number
    hasMore: boolean
  }> {
    const all = this.options.sessions ?? makeSessions()
    const filtered = opts?.includeArchived
      ? all
      : all.filter((s) => s.status === 'active')
    const offset = opts?.offset ?? 0
    const limit = opts?.limit ?? 20
    const slice = filtered.slice(offset, offset + limit)
    const owners = this.options.users ?? [
      makeSessionUser({ id: 'u-1', firstName: 'Alice', lastName: 'Smith', initials: 'AS' }),
      makeSessionUser({ id: 'u-2', firstName: 'Bob', lastName: 'Johnson', initials: 'BJ' }),
    ]
    const sessions = slice.map((s, i) => ({ ...s, owner: owners[i % owners.length] }))
    return { sessions, total: filtered.length, hasMore: offset + limit < filtered.length }
  }
  async archiveSession(sessionId: string): Promise<Session> {
    return this.options.session ?? makeSession({ id: sessionId, status: 'archived' })
  }
  async unarchiveSession(sessionId: string): Promise<Session> {
    return this.options.session ?? makeSession({ id: sessionId, status: 'active' })
  }
  async pinSession(sessionId: string): Promise<Session> {
    return this.options.session ?? makeSession({ id: sessionId, pinned: true })
  }
  async unpinSession(sessionId: string): Promise<Session> {
    return this.options.session ?? makeSession({ id: sessionId, pinned: false })
  }
  async deleteSession(_sessionId: string): Promise<void> {
    console.log('Mock delete session:', _sessionId)
  }
  async renameSession(sessionId: string, title: string): Promise<Session> {
    return this.options.session ?? makeSession({ id: sessionId, title })
  }
  async regenerateSessionTitle(sessionId: string): Promise<Session> {
    return this.options.session ?? makeSession({ id: sessionId, title: 'Regenerated Title' })
  }
}
