/**
 * MessageList component
 * Displays conversation turns with auto-scroll and grouping
 *
 * Uses turn-based architecture where each ConversationTurn groups
 * a user message with its assistant response.
 */

import { useCallback, useEffect, useRef, useMemo, ReactNode, useState, lazy, Suspense, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatSession, useChatMessaging } from '../context/ChatContext'
import { ConversationTurn } from '../types'
import { TurnBubble } from './TurnBubble'
import { TypingIndicator } from './TypingIndicator'
import { ActivityTrace } from './ActivityTrace'
import StreamingCursor from './StreamingCursor'
import ScrollToBottomButton from './ScrollToBottomButton'
import { DateSeparator } from './DateSeparator'
import { normalizeStreamingMarkdown } from '../utils/markdownStream'
import { useKeyboardShortcuts, type ShortcutConfig } from '../hooks/useKeyboardShortcuts'
import { useTranslation } from '../hooks/useTranslation'
import { isSameDay } from 'date-fns'

const MarkdownRenderer = lazy(() =>
  import('./MarkdownRenderer').then((m) => ({ default: m.MarkdownRenderer }))
)

function MessageListSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="w-3/5 max-w-md rounded-2xl bg-gray-100 dark:bg-gray-800 p-4 space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
      {/* Assistant message skeleton */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
        <div className="w-4/5 max-w-lg rounded-2xl bg-gray-100 dark:bg-gray-800 p-4 space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
      {/* Second user message skeleton */}
      <div className="flex justify-end">
        <div className="w-2/5 max-w-xs rounded-2xl bg-gray-100 dark:bg-gray-800 p-4 space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

function StreamingBubble({ content, normalizedContent }: { content: string; normalizedContent: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium text-xs">
        AI
      </div>
      <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 text-gray-900 dark:text-gray-100" style={{ maxWidth: 'var(--bichat-bubble-assistant-max-width, 85%)' }}>
        <Suspense
          fallback={
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
              {content}
            </div>
          }
        >
          <MarkdownRenderer content={normalizedContent} sendDisabled />
        </Suspense>
        <StreamingCursor />
      </div>
    </div>
  )
}

interface MessageListProps {
  /** Custom render function for user turns */
  renderUserTurn?: (turn: ConversationTurn) => ReactNode
  /** Custom render function for assistant turns */
  renderAssistantTurn?: (turn: ConversationTurn) => ReactNode
  /** Custom verbs for the typing indicator (e.g. ['Thinking', 'Analyzing', ...]) */
  thinkingVerbs?: string[]
  /** When true, hides edit/regenerate actions */
  readOnly?: boolean
}

export function MessageList({ renderUserTurn, renderAssistantTurn, thinkingVerbs, readOnly }: MessageListProps) {
  const { t } = useTranslation()
  const { currentSessionId, fetching } = useChatSession()
  const {
    turns,
    streamingContent,
    isStreaming,
    thinkingContent,
    activeSteps,
    showActivityTrace,
  } = useChatMessaging()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const initialScrollSessionRef = useRef<string | undefined>(undefined)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const prevTurnsLengthRef = useRef(turns.length)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      })
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  // Auto-scroll to bottom on new turns or streaming content (only when user is near bottom)
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      if (!isNearBottom) return
    }
    scrollToBottom('smooth')
  }, [turns.length, streamingContent, scrollToBottom])

  // On first open of a session, jump to latest message immediately.
  useEffect(() => {
    if (fetching || !currentSessionId || currentSessionId === 'new') return
    if (initialScrollSessionRef.current === currentSessionId) return

    const runInitialScroll = () => {
      scrollToBottom('auto')
      setShowScrollButton(false)
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(runInitialScroll)
    })
    const timeoutOne = setTimeout(runInitialScroll, 80)
    const timeoutTwo = setTimeout(runInitialScroll, 200)
    const timeoutThree = setTimeout(runInitialScroll, 400)

    initialScrollSessionRef.current = currentSessionId
    return () => {
      clearTimeout(timeoutOne)
      clearTimeout(timeoutTwo)
      clearTimeout(timeoutThree)
    }
  }, [currentSessionId, fetching, turns.length, scrollToBottom])

  // Scroll detection for ScrollToBottomButton
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollButton(!isNearBottom)
      if (isNearBottom) {
        setUnreadCount(0)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Track unread messages when scrolled up
  useEffect(() => {
    const prevLength = prevTurnsLengthRef.current
    prevTurnsLengthRef.current = turns.length
    if (turns.length > prevLength && showScrollButton) {
      setUnreadCount((c) => c + (turns.length - prevLength))
    }
  }, [turns.length, showScrollButton])

  // Keyboard shortcut: End key scrolls to bottom
  const scrollShortcuts = useMemo<ShortcutConfig[]>(
    () => [
      {
        key: 'End',
        callback: () => {
          scrollToBottom('smooth')
          setUnreadCount(0)
        },
        description: 'Scroll to bottom',
      },
    ],
    [scrollToBottom]
  )
  useKeyboardShortcuts(scrollShortcuts)

  const normalizedStreaming = useMemo(
    () => (streamingContent ? normalizeStreamingMarkdown(streamingContent) : ''),
    [streamingContent]
  )

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom('smooth')
    setUnreadCount(0)
  }, [scrollToBottom])

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={containerRef} className="h-full overflow-y-auto overflow-x-hidden px-4 py-6">
        <div className="mx-auto space-y-6">
          {/* Loading skeleton when no turns yet */}
          {fetching && turns.length === 0 && <MessageListSkeleton />}
          {turns.map((turn, index) => {
            const turnDate = new Date(turn.createdAt)
            const prevDate = index > 0 ? new Date(turns[index - 1].createdAt) : null
            // Only show date separators when the conversation spans multiple days
            const showDateSeparator = !!prevDate && !isSameDay(turnDate, prevDate)

            return (
              <Fragment key={turn.id}>
                {showDateSeparator && <DateSeparator date={turnDate} />}
                <TurnBubble
                  turn={turn}
                  isLastTurn={index === turns.length - 1}
                  renderUserTurn={renderUserTurn}
                  renderAssistantTurn={renderAssistantTurn}
                  userTurnProps={
                    readOnly
                      ? { allowEdit: false }
                      : { allowEdit: index === turns.length - 1 }
                  }
                  assistantTurnProps={readOnly ? { allowRegenerate: false } : undefined}
                />
              </Fragment>
            )
          })}
          {/* Activity Trace — shown during thinking / tool execution phase */}
          <AnimatePresence mode="wait">
            {showActivityTrace && (
              <motion.div
                key="activity-trace"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              >
                {(thinkingContent || activeSteps.length > 0) ? (
                  <ActivityTrace
                    thinkingContent={thinkingContent}
                    activeSteps={activeSteps}
                  />
                ) : (
                  <TypingIndicator verbs={thinkingVerbs} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {/* Streaming content — shown once final answer tokens arrive */}
          {isStreaming && streamingContent && (
            <StreamingBubble content={streamingContent} normalizedContent={normalizedStreaming} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ScrollToBottomButton
        show={showScrollButton}
        onClick={handleScrollToBottom}
        unreadCount={unreadCount}
        label={isStreaming && showScrollButton ? t('BiChat.ScrollToBottom.NewMessages') : undefined}
      />
    </div>
  )
}
