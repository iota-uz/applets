/**
 * Snapshot derivation helpers for the ChatMachine.
 *
 * These are pure functions that derive public snapshots from internal state.
 */

import { getSessionDebugUsage } from '../utils/debugTrace'
import type { ChatMachineState, SessionSnapshot, MessagingSnapshot, InputSnapshot } from './types'

export function deriveDebugMode(state: ChatMachineState): boolean {
  const key = state.session.currentSessionId || 'new'
  return state.session.debugModeBySession[key] ?? false
}

export function deriveSessionSnapshot(
  state: ChatMachineState,
  methods: Pick<SessionSnapshot, 'setError' | 'retryFetchSession'>
): SessionSnapshot {
  return {
    session: state.session.session,
    currentSessionId: state.session.currentSessionId,
    fetching: state.session.fetching,
    error: state.session.error,
    errorRetryable: state.session.errorRetryable,
    debugMode: deriveDebugMode(state),
    sessionDebugUsage: getSessionDebugUsage(state.messaging.turns),
    debugLimits: state.session.debugLimits,
    setError: methods.setError,
    retryFetchSession: methods.retryFetchSession,
  }
}

export function deriveMessagingSnapshot(
  state: ChatMachineState,
  methods: Pick<
    MessagingSnapshot,
    | 'sendMessage'
    | 'handleRegenerate'
    | 'handleEdit'
    | 'handleCopy'
    | 'handleSubmitQuestionAnswers'
    | 'handleRejectPendingQuestion'
    | 'retryLastMessage'
    | 'clearStreamError'
    | 'cancel'
    | 'setCodeOutputs'
  >
): MessagingSnapshot {
  return {
    turns: state.messaging.turns,
    streamingContent: state.messaging.streamingContent,
    isStreaming: state.messaging.isStreaming,
    streamError: state.messaging.streamError,
    streamErrorRetryable: state.messaging.streamErrorRetryable,
    loading: state.messaging.loading,
    pendingQuestion: state.messaging.pendingQuestion,
    codeOutputs: state.messaging.codeOutputs,
    isCompacting: state.messaging.isCompacting,
    compactionSummary: null,
    artifactsInvalidationTrigger: state.messaging.artifactsInvalidationTrigger,
    ...methods,
  }
}

export function deriveInputSnapshot(
  state: ChatMachineState,
  methods: Pick<
    InputSnapshot,
    | 'setMessage'
    | 'setInputError'
    | 'handleSubmit'
    | 'handleUnqueue'
    | 'enqueueMessage'
    | 'removeQueueItem'
    | 'updateQueueItem'
  >
): InputSnapshot {
  return {
    message: state.input.message,
    inputError: state.input.inputError,
    messageQueue: state.input.messageQueue,
    ...methods,
  }
}
