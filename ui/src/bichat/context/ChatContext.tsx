/**
 * Chat session context provider and hook
 * Manages state for chat sessions including turns, loading, streaming, and HITL
 *
 * Uses turn-based architecture where each ConversationTurn groups
 * a user message with its assistant response.
 *
 * Split into 3 focused contexts to minimize re-renders:
 * - ChatSessionContext: session lifecycle (session, fetching, error, debug)
 * - ChatMessagingContext: turns + streaming + tool interactions
 * - ChatInputContext: input form state (message, inputError, queue)
 *
 * Cross-context reads use refs (no subscription = no re-render).
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef, useMemo } from 'react'
import {
  type ChatDataSource,
  type Session,
  type ConversationTurn,
  type PendingQuestion,
  type QuestionAnswers,
  type Attachment,
  type QueuedMessage,
  type CodeOutput,
  type ChatSessionStateValue,
  type ChatMessagingStateValue,
  type ChatInputStateValue,
  type SendMessageOptions,
} from '../types'
import { RateLimiter, type RateLimiterConfig } from '../utils/RateLimiter'
import {
  getSessionDebugUsage,
} from '../utils/debugTrace'
import { loadQueue, saveQueue } from '../utils/queueStorage'
import {
  ARTIFACT_TOOL_NAMES,
  createPendingTurn,
  createCompactedSystemTurn,
  parseSlashCommand,
  readDebugLimitsFromGlobalContext,
  type ParsedSlashCommand,
} from './chatHelpers'
import { normalizeRPCError } from '../utils/errorDisplay'

// ---------------------------------------------------------------------------
// Internal contexts
// ---------------------------------------------------------------------------

const SessionCtx = createContext<ChatSessionStateValue | null>(null)
const MessagingCtx = createContext<ChatMessagingStateValue | null>(null)
const InputCtx = createContext<ChatInputStateValue | null>(null)

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

interface ChatSessionProviderProps {
  dataSource: ChatDataSource
  sessionId?: string
  rateLimiter?: RateLimiter
  /** Configuration for the built-in rate limiter (ignored when rateLimiter is provided). */
  rateLimitConfig?: RateLimiterConfig
  children: ReactNode
}

interface LastSendAttempt {
  content: string
  attachments: Attachment[]
  options?: SendMessageOptions
}

const MAX_QUEUE_SIZE = 5

const DEFAULT_RATE_LIMIT_CONFIG: RateLimiterConfig = {
  maxRequests: 20,
  windowMs: 60000,
}

// ---------------------------------------------------------------------------
// Composed Provider
// ---------------------------------------------------------------------------

export function ChatSessionProvider({
  dataSource,
  sessionId,
  rateLimiter: externalRateLimiter,
  rateLimitConfig,
  children
}: ChatSessionProviderProps) {
  // ── Session state ──────────────────────────────────────────────────────
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(sessionId)
  const [session, setSession] = useState<Session | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorRetryable, setErrorRetryable] = useState(false)
  const [sessionReloadNonce, setSessionReloadNonce] = useState(0)
  const [debugModeBySession, setDebugModeBySession] = useState<Record<string, boolean>>({})

  const debugSessionKey = currentSessionId || 'new'
  const debugMode = debugModeBySession[debugSessionKey] ?? false
  const debugLimits = useMemo(() => readDebugLimitsFromGlobalContext(), [])

  // ── Messaging state ────────────────────────────────────────────────────
  const [turns, setTurns] = useState<ConversationTurn[]>([])
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [streamErrorRetryable, setStreamErrorRetryable] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null)
  const [codeOutputs, setCodeOutputs] = useState<CodeOutput[]>([])
  const [isCompacting, setIsCompacting] = useState(false)
  const [compactionSummary, setCompactionSummary] = useState<string | null>(null)
  const [artifactsInvalidationTrigger, setArtifactsInvalidationTrigger] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastSendAttemptRef = useRef<LastSendAttempt | null>(null)

  // ── Input state ────────────────────────────────────────────────────────
  const [message, setMessage] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([])
  const messageQueueRef = useRef<QueuedMessage[]>([])

  // ── Rate limiter ───────────────────────────────────────────────────────
  const rateLimiterRef = useRef<RateLimiter>(
    externalRateLimiter || new RateLimiter(rateLimitConfig || DEFAULT_RATE_LIMIT_CONFIG)
  )

  // ── Refs for cross-context reads (no re-render subscription) ───────────
  const sessionRef = useRef({ currentSessionId, debugMode, debugSessionKey })
  sessionRef.current = { currentSessionId, debugMode, debugSessionKey }

  const messagingRef = useRef({ turns, pendingQuestion, loading })
  messagingRef.current = { turns, pendingQuestion, loading }

  useEffect(() => { messageQueueRef.current = messageQueue }, [messageQueue])

  // ── Derived ────────────────────────────────────────────────────────────
  const sessionDebugUsage = useMemo(() => getSessionDebugUsage(turns), [turns])
  const clearStreamError = useCallback(() => {
    setStreamError(null)
    setStreamErrorRetryable(false)
  }, [])

  const setSessionError = useCallback((nextError: string | null, retryable = false) => {
    setError(nextError)
    setErrorRetryable(nextError ? retryable : false)
  }, [])

  const retryFetchSession = useCallback(() => {
    setSessionReloadNonce((prev) => prev + 1)
  }, [])

  // ── Sync sessionId prop ────────────────────────────────────────────────
  useEffect(() => {
    setCurrentSessionId(sessionId)
  }, [sessionId])

  // ── Restore queued messages per session (sessionStorage) ───────────────
  useEffect(() => {
    const sid = currentSessionId
    if (!sid || sid === 'new') {
      setMessageQueue([])
      return
    }
    setMessageQueue(loadQueue(sid))
  }, [currentSessionId])

  // ── Persist queued messages per session (sessionStorage) ───────────────
  useEffect(() => {
    const sid = currentSessionId
    if (!sid || sid === 'new') return
    saveQueue(sid, messageQueue)
  }, [currentSessionId, messageQueue])

  // ── Fetch session ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentSessionId || currentSessionId === 'new') {
      setSession(null)
      setTurns([])
      setPendingQuestion(null)
      setFetching(false)
      setSessionError(null)
      setInputError(null)
      return
    }

    let cancelled = false

    setFetching(true)
    setSessionError(null)
    setInputError(null)

    dataSource
      .fetchSession(currentSessionId)
      .then((state) => {
        if (cancelled) return

        if (state) {
          setSession(state.session)
          setTurns((prev) => {
            const hasPendingUserOnly =
              prev.length > 0 && !prev[prev.length - 1].assistantTurn
            if (
              hasPendingUserOnly &&
              (!state.turns || state.turns.length === 0)
            ) {
              return prev
            }
            return state.turns ?? prev
          })
          setPendingQuestion(state.pendingQuestion || null)
        } else {
          setSessionError('Session not found')
        }
        setFetching(false)
      })
      .catch((err) => {
        if (cancelled) return
        const normalized = normalizeRPCError(err, 'Failed to load session')
        setSessionError(normalized.userMessage, normalized.retryable)
        setFetching(false)
      })

    return () => {
      cancelled = true
    }
  }, [dataSource, currentSessionId, sessionReloadNonce, setSessionError])

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
  }, [])

  const executeSlashCommand = useCallback(
    async (command: ParsedSlashCommand): Promise<boolean> => {
      if (command.hasArgs) {
        setInputError('BiChat.Slash.ErrorNoArguments')
        return true
      }

      setSessionError(null)
      setInputError(null)
      clearStreamError()

      if (command.name === '/debug') {
        const curDebugMode = sessionRef.current.debugMode
        const curDebugSessionKey = sessionRef.current.debugSessionKey
        const curSessionId = sessionRef.current.currentSessionId
        const nextDebugMode = !curDebugMode
        setDebugModeBySession((prev) => ({
          ...prev,
          [curDebugSessionKey]: nextDebugMode,
        }))

        if (nextDebugMode && curSessionId && curSessionId !== 'new') {
          try {
            const state = await dataSource.fetchSession(curSessionId)
            if (state) {
              setSession(state.session)
              setTurns(state.turns)
              setPendingQuestion(state.pendingQuestion || null)
            }
          } catch (err) {
            console.error('Failed to refresh session for debug mode:', err)
          }
        }

        setMessage('')
        return true
      }

      const curSessionId = sessionRef.current.currentSessionId
      if (!curSessionId || curSessionId === 'new') {
        setInputError('BiChat.Slash.ErrorSessionRequired')
        return true
      }

      if (command.name === '/clear') {
        setMessage('')
        setLoading(true)
        setStreamingContent('')

        try {
          await dataSource.clearSessionHistory(curSessionId)
          const state = await dataSource.fetchSession(curSessionId)
          if (state) {
            setSession(state.session)
            setTurns(state.turns)
            setPendingQuestion(state.pendingQuestion || null)
          } else {
            setTurns([])
          }
          setCompactionSummary(null)
          setCodeOutputs([])
        } catch (err) {
          const normalized = normalizeRPCError(err, 'Failed to clear session history')
          setInputError(normalized.userMessage)
        } finally {
          setLoading(false)
          setIsStreaming(false)
        }
        return true
      }

      if (command.name === '/compact') {
        setMessage('')
        setLoading(true)
        setIsCompacting(true)
        setCompactionSummary(null)
        setStreamingContent('')

        try {
          const result = await dataSource.compactSessionHistory(curSessionId)
          const summary = result.summary || ''
          setTurns([createCompactedSystemTurn(curSessionId, summary)])
          setCompactionSummary(null)

          const state = await dataSource.fetchSession(curSessionId)
          if (state) {
            setSession(state.session)
            setTurns(state.turns)
            setPendingQuestion(state.pendingQuestion || null)
          } else {
            setTurns([])
          }

          setCodeOutputs([])
        } catch (err) {
          const normalized = normalizeRPCError(err, 'Failed to compact session history')
          setInputError(normalized.userMessage)
        } finally {
          setIsCompacting(false)
          setLoading(false)
          setIsStreaming(false)
        }
        return true
      }

      setInputError('BiChat.Slash.ErrorUnknownCommand')
      return true
    },
    [clearStreamError, dataSource, setSessionError]
  )

  const sendMessageDirect = useCallback(
    async (
      content: string,
      attachments: Attachment[] = [],
      options?: SendMessageOptions
    ): Promise<void> => {
      if (!content.trim() || messagingRef.current.loading) return

      const trimmedContent = content.trim()
      if (trimmedContent.startsWith('/')) {
        const maybeCommand = parseSlashCommand(content)
        if (!maybeCommand) {
          setInputError('BiChat.Slash.ErrorUnknownCommand')
          return
        }
        if (attachments.length > 0) {
          setInputError('BiChat.Slash.ErrorNoAttachments')
          return
        }
        await executeSlashCommand(maybeCommand)
        return
      }

      if (!rateLimiterRef.current.canMakeRequest()) {
        const timeUntilNext = rateLimiterRef.current.getTimeUntilNextRequest()
        const seconds = Math.ceil(timeUntilNext / 1000)
        setInputError(`Rate limit exceeded. Please wait ${seconds} seconds before sending another message.`)
        return
      }

      setMessage('')
      setLoading(true)
      setSessionError(null)
      setInputError(null)
      clearStreamError()
      setStreamingContent('')
      setCompactionSummary(null)

      abortControllerRef.current = new AbortController()

      const curSessionId = sessionRef.current.currentSessionId
      const curDebugMode = sessionRef.current.debugMode
      const tempTurn = createPendingTurn(curSessionId || 'new', content, attachments)
      const replaceFromMessageID = options?.replaceFromMessageID
      lastSendAttemptRef.current = { content, attachments, options }
      setTurns((prev) => {
        if (!replaceFromMessageID) {
          return [...prev, tempTurn]
        }
        const replaceIndex = prev.findIndex((turn) => turn.userTurn.id === replaceFromMessageID)
        if (replaceIndex === -1) {
          console.warn(
            `[ChatContext] replaceFromMessageID "${replaceFromMessageID}" not found in turns; appending as new turn`
          )
          return [...prev, tempTurn]
        }
        return [...prev.slice(0, replaceIndex), tempTurn]
      })

      let shouldDrainQueue = true

      try {
        let activeSessionId = curSessionId
        let shouldNavigateAfter = false

        if (!activeSessionId || activeSessionId === 'new') {
          const result = await dataSource.createSession()
          if (result) {
            const createdSessionID = result.id
            activeSessionId = createdSessionID
            setCurrentSessionId(createdSessionID)
            setDebugModeBySession((prev) => {
              if (!curDebugMode) return prev
              return { ...prev, [createdSessionID]: true }
            })
            shouldNavigateAfter = true
          }
        }

        let accumulatedContent = ''
        let createdSessionId: string | undefined
        let sessionFetched = false
        setIsStreaming(true)

        for await (const chunk of dataSource.sendMessage(
          activeSessionId || 'new',
          content,
          attachments,
          abortControllerRef.current?.signal,
          {
            debugMode: curDebugMode,
            replaceFromMessageID,
          }
        )) {
          if (abortControllerRef.current?.signal.aborted) {
            break
          }

          if ((chunk.type === 'chunk' || chunk.type === 'content') && chunk.content) {
            accumulatedContent += chunk.content
            setStreamingContent(accumulatedContent)
          } else if (chunk.type === 'error') {
            throw new Error(chunk.error || 'Stream error')
          } else if (chunk.type === 'interrupt' || chunk.type === 'done') {
            if (chunk.sessionId) {
              createdSessionId = chunk.sessionId
            }
            if (!sessionFetched) {
              sessionFetched = true
              const finalSessionId = createdSessionId || activeSessionId
              if (finalSessionId && finalSessionId !== 'new') {
                const state = await dataSource.fetchSession(finalSessionId)
                if (state) {
                  setSession(state.session)
                  setTurns((prev) => {
                    const hasPendingUserOnly =
                      prev.length > 0 && !prev[prev.length - 1].assistantTurn
                    if (
                      hasPendingUserOnly &&
                      (!state.turns || state.turns.length === 0)
                    ) {
                      return prev
                    }
                    return state.turns ?? prev
                  })
                  setPendingQuestion(state.pendingQuestion || null)
                }
              }
            }
          } else if (chunk.type === 'user_message' && chunk.sessionId) {
            createdSessionId = chunk.sessionId
          } else if (chunk.type === 'tool_end' && chunk.tool?.name && ARTIFACT_TOOL_NAMES.has(chunk.tool.name)) {
            setArtifactsInvalidationTrigger((n) => n + 1)
          }
        }

        const targetSessionId = createdSessionId || activeSessionId
        if (shouldNavigateAfter && targetSessionId && targetSessionId !== 'new') {
          dataSource.navigateToSession?.(targetSessionId)
        }
        clearStreamError()
        lastSendAttemptRef.current = null
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setMessage(content)
          clearStreamError()
          shouldDrainQueue = false
          return
        }

        setTurns((prev) => prev.filter((t) => t.id !== tempTurn.id))

        const normalized = normalizeRPCError(err, 'Failed to send message')
        setInputError(normalized.userMessage)
        setStreamError(normalized.userMessage)
        setStreamErrorRetryable(normalized.retryable)
        console.error('Send message error:', err)
        shouldDrainQueue = false
      } finally {
        setLoading(false)
        setStreamingContent('')
        setIsStreaming(false)
        abortControllerRef.current = null

        // Auto-drain: send next queued message if any (only on success)
        if (shouldDrainQueue) {
          const queue = messageQueueRef.current
          if (queue.length > 0) {
            const next = queue[0]
            setMessageQueue(prev => prev.slice(1))
            // Use setTimeout to avoid calling sendMessageDirect during its own cleanup
            setTimeout(() => {
              sendMessageDirect(next.content, next.attachments)
            }, 0)
          }
        }
      }
    },
    [clearStreamError, dataSource, executeSlashCommand, setSessionError]
  )

  const retryLastMessage = useCallback(async () => {
    const lastAttempt = lastSendAttemptRef.current
    if (!lastAttempt || messagingRef.current.loading) return
    clearStreamError()
    setInputError(null)
    await sendMessageDirect(lastAttempt.content, lastAttempt.attachments, lastAttempt.options)
  }, [clearStreamError, sendMessageDirect])

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsStreaming(false)
      setLoading(false)
    }
  }, [])

  const enqueueMessage = useCallback((content: string, attachments: Attachment[]): boolean => {
    if (messageQueueRef.current.length >= MAX_QUEUE_SIZE) {
      setInputError('BiChat.Input.QueueFull')
      return false
    }
    setMessageQueue(prev => [...prev, { content, attachments }])
    return true
  }, [])

  const removeQueueItem = useCallback((index: number) => {
    setMessageQueue(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateQueueItem = useCallback((index: number, content: string) => {
    setMessageQueue(prev => prev.map((item, i) => i === index ? { ...item, content } : item))
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent, attachments: Attachment[] = []) => {
      e.preventDefault()
      if (!message.trim() && attachments.length === 0) return
      setInputError(null)
      clearStreamError()

      const convertedAttachments: Attachment[] = attachments.map(att => ({
        clientKey: att.clientKey || crypto.randomUUID(),
        filename: att.filename,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        base64Data: att.base64Data,
        url: att.url,
        preview: att.preview,
      }))

      // Queue if currently generating
      if (messagingRef.current.loading) {
        const ok = enqueueMessage(message.trim(), convertedAttachments)
        if (ok) {
          setMessage('')
        }
        return
      }

      sendMessageDirect(message, convertedAttachments)
    },
    [clearStreamError, message, sendMessageDirect, enqueueMessage]
  )

  const handleUnqueue = useCallback(() => {
    if (messageQueue.length === 0) {
      return null
    }

    const lastQueued = messageQueue[messageQueue.length - 1]
    setMessageQueue(prev => prev.slice(0, -1))

    return {
      content: lastQueued.content,
      attachments: lastQueued.attachments
    }
  }, [messageQueue])

  const handleRegenerate = useCallback(
    async (turnId: string) => {
      const curSessionId = sessionRef.current.currentSessionId
      if (!curSessionId || curSessionId === 'new') return

      const turn = messagingRef.current.turns.find((t) => t.id === turnId)
      if (!turn) return

      setSessionError(null)

      try {
        await sendMessageDirect(turn.userTurn.content, turn.userTurn.attachments, {
          replaceFromMessageID: turn.userTurn.id,
        })
      } catch (err) {
        const normalized = normalizeRPCError(err, 'Failed to regenerate response')
        setSessionError(normalized.userMessage, normalized.retryable)
        console.error('Regenerate error:', err)
      }
    },
    [sendMessageDirect, setSessionError]
  )

  const handleEdit = useCallback(
    async (turnId: string, newContent: string) => {
      const curSessionId = sessionRef.current.currentSessionId
      if (!curSessionId || curSessionId === 'new') {
        setMessage(newContent)
        setTurns((prev) => prev.filter((t) => t.id !== turnId))
        return
      }

      const turn = messagingRef.current.turns.find((t) => t.id === turnId)
      if (!turn) {
        setSessionError('Failed to edit message')
        return
      }

      setSessionError(null)

      try {
        await sendMessageDirect(newContent, turn.userTurn.attachments, {
          replaceFromMessageID: turn.userTurn.id,
        })
      } catch (err) {
        const normalized = normalizeRPCError(err, 'Failed to edit message')
        setSessionError(normalized.userMessage, normalized.retryable)
        console.error('Edit error:', err)
      }
    },
    [sendMessageDirect, setSessionError]
  )

  const handleSubmitQuestionAnswers = useCallback(
    (answers: QuestionAnswers) => {
      const curSessionId = sessionRef.current.currentSessionId
      const curPendingQuestion = messagingRef.current.pendingQuestion
      if (!curSessionId || !curPendingQuestion) return

      setLoading(true)
      setSessionError(null)
      const previousPendingQuestion = curPendingQuestion
      setPendingQuestion(null)

      ;(async () => {
        try {
          const result = await dataSource.submitQuestionAnswers(
            curSessionId,
            previousPendingQuestion.id,
            answers
          )

          if (result.success) {
            if (curSessionId !== 'new') {
              try {
                const state = await dataSource.fetchSession(curSessionId)
                if (state) {
                  setTurns(state.turns)
                  setPendingQuestion(state.pendingQuestion || null)
                } else {
                  setPendingQuestion(previousPendingQuestion)
                  setSessionError('Failed to load updated session')
                }
              } catch (fetchErr) {
                setPendingQuestion(previousPendingQuestion)
                const normalized = normalizeRPCError(fetchErr, 'Failed to load updated session')
                setSessionError(normalized.userMessage, normalized.retryable)
              }
            }
          } else {
            setPendingQuestion(previousPendingQuestion)
            setSessionError(result.error || 'Failed to submit answers')
          }
        } catch (err) {
          setPendingQuestion(previousPendingQuestion)
          const normalized = normalizeRPCError(err, 'Failed to submit answers')
          setSessionError(normalized.userMessage, normalized.retryable)
        } finally {
          setLoading(false)
        }
      })()
    },
    [dataSource, setSessionError]
  )

  const handleRejectPendingQuestion = useCallback(async () => {
    const curSessionId = sessionRef.current.currentSessionId
    const curPendingQuestion = messagingRef.current.pendingQuestion
    if (!curSessionId || !curPendingQuestion) return

    try {
      const result = await dataSource.rejectPendingQuestion(curSessionId)
      if (result.success) {
        setPendingQuestion(null)
        // Re-fetch to get updated turns (agent may have resumed)
        if (curSessionId !== 'new') {
          const state = await dataSource.fetchSession(curSessionId)
          if (state) {
            setSession(state.session)
            setTurns((prev) => {
              const hasPendingUserOnly =
                prev.length > 0 && !prev[prev.length - 1].assistantTurn
              if (
                hasPendingUserOnly &&
                (!state.turns || state.turns.length === 0)
              ) {
                return prev
              }
              return state.turns ?? prev
            })
            setPendingQuestion(state.pendingQuestion || null)
          }
        }
      } else {
        setSessionError(result.error || 'Failed to reject question')
      }
    } catch (err) {
      const normalized = normalizeRPCError(err, 'Failed to reject question')
      setSessionError(normalized.userMessage, normalized.retryable)
    }
  }, [dataSource, setSessionError])

  // ── Context values (memoized per-context) ──────────────────────────────

  const sessionValue: ChatSessionStateValue = useMemo(() => ({
    session,
    currentSessionId,
    fetching,
    error,
    errorRetryable,
    debugMode,
    sessionDebugUsage,
    debugLimits,
    setError: setSessionError,
    retryFetchSession,
  }), [session, currentSessionId, fetching, error, errorRetryable, debugMode, sessionDebugUsage, debugLimits, setSessionError, retryFetchSession])

  const messagingValue: ChatMessagingStateValue = useMemo(() => ({
    turns,
    streamingContent,
    isStreaming,
    streamError,
    streamErrorRetryable,
    loading,
    pendingQuestion,
    codeOutputs,
    isCompacting,
    compactionSummary,
    artifactsInvalidationTrigger,
    sendMessage: sendMessageDirect,
    handleRegenerate,
    handleEdit,
    handleCopy,
    handleSubmitQuestionAnswers,
    handleRejectPendingQuestion,
    retryLastMessage,
    clearStreamError,
    cancel: cancelStream,
    setCodeOutputs,
  }), [
    turns, streamingContent, isStreaming, streamError, streamErrorRetryable, loading, pendingQuestion,
    codeOutputs, isCompacting, compactionSummary, artifactsInvalidationTrigger,
    sendMessageDirect, handleRegenerate, handleEdit, handleCopy,
    handleSubmitQuestionAnswers, handleRejectPendingQuestion, retryLastMessage, clearStreamError, cancelStream,
  ])

  const inputValue: ChatInputStateValue = useMemo(() => ({
    message,
    inputError,
    messageQueue,
    setMessage,
    setInputError,
    handleSubmit,
    handleUnqueue,
    enqueueMessage,
    removeQueueItem,
    updateQueueItem,
  }), [message, inputError, messageQueue, handleSubmit, handleUnqueue, enqueueMessage, removeQueueItem, updateQueueItem])

  return (
    <SessionCtx.Provider value={sessionValue}>
      <MessagingCtx.Provider value={messagingValue}>
        <InputCtx.Provider value={inputValue}>
          {children}
        </InputCtx.Provider>
      </MessagingCtx.Provider>
    </SessionCtx.Provider>
  )
}

// ---------------------------------------------------------------------------
// Focused hooks
// ---------------------------------------------------------------------------

export function useChatSession(): ChatSessionStateValue {
  const context = useContext(SessionCtx)
  if (!context) {
    throw new Error('useChatSession must be used within ChatSessionProvider')
  }
  return context
}

export function useChatMessaging(): ChatMessagingStateValue {
  const context = useContext(MessagingCtx)
  if (!context) {
    throw new Error('useChatMessaging must be used within ChatSessionProvider')
  }
  return context
}

/** Returns messaging context or null when outside ChatSessionProvider. Use when component can receive values via props (e.g. SessionArtifactsPanel with artifactsInvalidationTrigger prop). */
export function useOptionalChatMessaging(): ChatMessagingStateValue | null {
  return useContext(MessagingCtx)
}

export function useChatInput(): ChatInputStateValue {
  const context = useContext(InputCtx)
  if (!context) {
    throw new Error('useChatInput must be used within ChatSessionProvider')
  }
  return context
}
