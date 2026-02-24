/**
 * MessageList — displays conversation turns with auto-scroll and grouping.
 *
 * Uses turn-based architecture where each ConversationTurn groups
 * a user message with its assistant response.
 */

import { useMemo, ReactNode, lazy, Suspense, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatSession, useChatMessaging } from '../context/ChatContext';
import { ConversationTurn } from '../types';
import { TurnBubble } from './TurnBubble';
import { TypingIndicator } from './TypingIndicator';
import { ActivityTrace } from './ActivityTrace';
import StreamingCursor from './StreamingCursor';
import ScrollToBottomButton from './ScrollToBottomButton';
import { DateSeparator } from './DateSeparator';
import { normalizeStreamingMarkdown } from '../utils/markdownStream';
import { useMessageListScroll } from '../hooks/useMessageListScroll';
import { useTranslation } from '../hooks/useTranslation';
import { isSameDay } from 'date-fns';

// Eagerly start loading the chunk so it's ready before streaming begins
const markdownImport = import('./MarkdownRenderer');
const MarkdownRenderer = lazy(() =>
  markdownImport.then((m) => ({ default: m.MarkdownRenderer }))
);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MessageListSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex justify-end">
        <div className="w-3/5 max-w-md rounded-2xl bg-gray-100 dark:bg-gray-800 p-4 space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
        <div className="w-4/5 max-w-lg rounded-2xl bg-gray-100 dark:bg-gray-800 p-4 space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="w-2/5 max-w-xs rounded-2xl bg-gray-100 dark:bg-gray-800 p-4 space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
    </div>
  );
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
  );
}

// ---------------------------------------------------------------------------
// MessageList
// ---------------------------------------------------------------------------

interface MessageListProps {
  renderUserTurn?: (turn: ConversationTurn) => ReactNode
  renderAssistantTurn?: (turn: ConversationTurn) => ReactNode
  thinkingVerbs?: string[]
  readOnly?: boolean
}

export function MessageList({ renderUserTurn, renderAssistantTurn, thinkingVerbs, readOnly }: MessageListProps) {
  const { t } = useTranslation();
  const { session, currentSessionId, fetching } = useChatSession();
  const {
    turns, streamingContent, isStreaming,
    thinkingContent, activeSteps,
    showActivityTrace, showTypingIndicator,
  } = useChatMessaging();

  const { containerRef, messagesEndRef, showScrollButton, unreadCount, handleScrollToBottom } =
    useMessageListScroll({ currentSessionId, fetching, turnsLength: turns.length, streamingContent });

  const normalizedStreaming = useMemo(
    () => (streamingContent ? normalizeStreamingMarkdown(streamingContent) : ''),
    [streamingContent],
  );
  const showAuthorNames = Boolean(session?.isGroup || ((session?.memberCount ?? 0) > 1));

  const showEphemeral = showActivityTrace || showTypingIndicator;

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={containerRef} className="h-full overflow-y-auto overflow-x-hidden px-4 py-6">
        <div className="mx-auto space-y-6">
          {fetching && turns.length === 0 && <MessageListSkeleton />}

          {turns.map((turn, index) => {
            const turnDate = new Date(turn.createdAt);
            const prevDate = index > 0 ? new Date(turns[index - 1].createdAt) : null;
            const showDateSeparator = !!prevDate && !isSameDay(turnDate, prevDate);
            const isLast = index === turns.length - 1;
            const userTurnProps = {
              allowEdit: readOnly ? false : isLast,
              showAuthorName: showAuthorNames,
            };

            return (
              <Fragment key={turn.id}>
                {showDateSeparator && <DateSeparator date={turnDate} />}
                <TurnBubble
                  turn={turn}
                  isLastTurn={isLast}
                  renderUserTurn={renderUserTurn}
                  renderAssistantTurn={renderAssistantTurn}
                  userTurnProps={userTurnProps}
                  assistantTurnProps={readOnly ? { allowRegenerate: false } : undefined}
                />
              </Fragment>
            );
          })}

          {isStreaming && streamingContent && (
            <StreamingBubble content={streamingContent} normalizedContent={normalizedStreaming} />
          )}

          <AnimatePresence>
            {showEphemeral && (
              <motion.div
                key="activity-trace"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              >
                {showActivityTrace && (
                  <ActivityTrace thinkingContent={thinkingContent} activeSteps={activeSteps} />
                )}
                {showTypingIndicator && <TypingIndicator verbs={thinkingVerbs} />}
              </motion.div>
            )}
          </AnimatePresence>

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
  );
}
