/**
 * Main ChatSession component
 * Composes ChatHeader, MessageList, and MessageInput
 *
 * Uses turn-based architecture where each ConversationTurn groups
 * a user message with its assistant response.
 *
 * Supports customization via slots:
 * - headerSlot: Custom content above the message list
 * - welcomeSlot: Replace the default welcome screen for new chats
 * - logoSlot: Custom logo in the header
 * - actionsSlot: Custom action buttons in the header
 */

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar, Users } from '@phosphor-icons/react';
import { ChatSessionProvider, useChatSession, useChatMessaging, useChatInput } from '../context/ChatContext';
import { ChatDataSource, ConversationTurn } from '../types';
import { RateLimiter } from '../utils/RateLimiter';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import CompactionDoodle from './CompactionDoodle';
import WelcomeContent from './WelcomeContent';
import ArchiveBanner from './ArchiveBanner';
import { useTranslation } from '../hooks/useTranslation';
import { SessionArtifactsPanel } from './SessionArtifactsPanel';
import { SessionMembersModal } from './SessionMembersModal';
import Alert from './Alert';
import { StreamError } from './StreamError';

interface ChatSessionProps {
  dataSource: ChatDataSource
  sessionId?: string
  /** Optional rate limiter to throttle sendMessage */
  rateLimiter?: RateLimiter
  /**
   * Called when a new session is created (e.g. on first message in a "new
   * chat"). Use this to navigate your SPA router to the new session URL.
   *
   * Replaces the deprecated `dataSource.navigateToSession`.
   */
  onSessionCreated?: (sessionId: string) => void
  /** Alias for isReadOnly (preferred) */
  readOnly?: boolean
  isReadOnly?: boolean
  /** Custom render function for user turns */
  renderUserTurn?: (turn: ConversationTurn) => ReactNode
  /** Custom render function for assistant turns */
  renderAssistantTurn?: (turn: ConversationTurn) => ReactNode
  className?: string
  /** Custom content to display as header */
  headerSlot?: ReactNode
  /** Custom welcome screen component (replaces default WelcomeContent) */
  welcomeSlot?: ReactNode
  /** Custom logo for the header */
  logoSlot?: ReactNode
  /** Custom action buttons for the header */
  actionsSlot?: ReactNode
  /** Callback when user navigates back */
  onBack?: () => void
  /** Custom verbs for the typing indicator (e.g. ['Thinking', 'Analyzing', ...]) */
  thinkingVerbs?: string[]
  /** Callback invoked after an archived session is restored (e.g. to navigate or refresh) */
  onSessionRestored?: (sessionId: string) => void
  /** Enables the built-in right-side artifacts panel for persisted session artifacts */
  showArtifactsPanel?: boolean
  /** Initial expanded state for artifacts panel when no persisted preference exists */
  artifactsPanelDefaultExpanded?: boolean
  /** localStorage key for artifacts panel expanded/collapsed state */
  artifactsPanelStorageKey?: string
}

const ARTIFACTS_PANEL_WIDTH_DEFAULT = 352;
const ARTIFACTS_PANEL_WIDTH_MIN = 280;
const ARTIFACTS_PANEL_WIDTH_MAX = 560;

function ChatSessionCore({
  dataSource,
  readOnly,
  isReadOnly,
  renderUserTurn,
  renderAssistantTurn,
  className = '',
  headerSlot,
  welcomeSlot,
  logoSlot,
  actionsSlot,
  onBack,
  thinkingVerbs,
  onSessionRestored,
  showArtifactsPanel = false,
  artifactsPanelDefaultExpanded = false,
  artifactsPanelStorageKey = 'bichat.artifacts-panel.expanded',
}: Omit<ChatSessionProps, 'sessionId'>) {
  const { t } = useTranslation();
  const {
    session,
    fetching,
    error,
    errorRetryable,
    debugMode,
    sessionDebugUsage,
    debugLimits,
    currentSessionId,
    setError,
    retryFetchSession,
  } =
    useChatSession();
  const {
    turns,
    loading,
    isStreaming,
    cancel,
    streamError,
    streamErrorRetryable,
    isCompacting,
    retryLastMessage,
    clearStreamError,
  } = useChatMessaging();
  const {
    inputError,
    message,
    setMessage,
    setInputError,
    handleSubmit,
    messageQueue,
    handleUnqueue,
    removeQueueItem,
    updateQueueItem,
  } = useChatInput();

  const isArchived = session?.status === 'archived';
  const accessReadOnly = session?.access ? !session.access.canWrite : false;
  const effectiveReadOnly = Boolean(readOnly ?? isReadOnly) || isArchived || accessReadOnly;
  const [restoring, setRestoring] = useState(false);

  const handleRestore = useCallback(async () => {
    if (!session?.id) {return;}
    setRestoring(true);
    try {
      await dataSource.unarchiveSession(session.id);
      retryFetchSession();
      window.dispatchEvent(new CustomEvent('bichat:sessions-updated', {
        detail: { reason: 'restored', sessionId: session.id },
      }));
      onSessionRestored?.(session.id);
    } finally {
      setRestoring(false);
    }
  }, [dataSource, onSessionRestored, retryFetchSession, session?.id]);

  const [artifactsPanelExpanded, setArtifactsPanelExpanded] = useState(
    artifactsPanelDefaultExpanded
  );
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [artifactsPanelWidth, setArtifactsPanelWidth] = useState(ARTIFACTS_PANEL_WIDTH_DEFAULT);
  const [isResizingArtifactsPanel, setIsResizingArtifactsPanel] = useState(false);
  const layoutContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showArtifactsPanel) {
      return;
    }

    let nextValue = artifactsPanelDefaultExpanded;
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(artifactsPanelStorageKey);
      if (stored !== null) {
        nextValue = stored === 'true';
      }
    }

    setArtifactsPanelExpanded(nextValue);
  }, [artifactsPanelDefaultExpanded, artifactsPanelStorageKey, showArtifactsPanel]);

  useEffect(() => {
    if (!showArtifactsPanel) {return;}
    if (typeof window === 'undefined') {return;}
    try {
      const raw = window.localStorage.getItem(`${artifactsPanelStorageKey}.width`);
      if (raw !== null) {
        const n = Number.parseInt(raw, 10);
        if (Number.isFinite(n) && n >= ARTIFACTS_PANEL_WIDTH_MIN && n <= ARTIFACTS_PANEL_WIDTH_MAX) {
          setArtifactsPanelWidth(n);
        }
      }
    } catch {
      // ignore
    }
  }, [artifactsPanelStorageKey, showArtifactsPanel]);

  const handleArtifactsResizeStart = useCallback(() => {
    setIsResizingArtifactsPanel(true);
  }, []);

  const handleArtifactsResizeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 40 : 20;
      let nextWidth: number | null = null;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextWidth = Math.min(ARTIFACTS_PANEL_WIDTH_MAX, artifactsPanelWidth + step);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextWidth = Math.max(ARTIFACTS_PANEL_WIDTH_MIN, artifactsPanelWidth - step);
      } else if (e.key === 'Home') {
        nextWidth = ARTIFACTS_PANEL_WIDTH_MIN;
      } else if (e.key === 'End') {
        nextWidth = ARTIFACTS_PANEL_WIDTH_MAX;
      }

      if (nextWidth !== null) {
        e.preventDefault();
        setArtifactsPanelWidth(nextWidth);
        try {
          window.localStorage.setItem(`${artifactsPanelStorageKey}.width`, String(nextWidth));
        } catch {
          // ignore
        }
      }
    },
    [artifactsPanelWidth, artifactsPanelStorageKey],
  );

  const lastPanelWidthRef = useRef(artifactsPanelWidth);
  lastPanelWidthRef.current = artifactsPanelWidth;

  useEffect(() => {
    if (!isResizingArtifactsPanel) {return;}

    const move = (e: MouseEvent) => {
      const el = layoutContainerRef.current;
      if (!el) {return;}
      const rect = el.getBoundingClientRect();
      const w = rect.right - e.clientX;
      const clamped = Math.min(ARTIFACTS_PANEL_WIDTH_MAX, Math.max(ARTIFACTS_PANEL_WIDTH_MIN, w));
      setArtifactsPanelWidth(clamped);
    };

    const up = () => {
      setIsResizingArtifactsPanel(false);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            `${artifactsPanelStorageKey}.width`,
            String(lastPanelWidthRef.current)
          );
        }
      } catch {
        // ignore
      }
    };

    document.addEventListener('mousemove', move, { passive: true });
    document.addEventListener('mouseup', up);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingArtifactsPanel, artifactsPanelStorageKey]);

  if (fetching && turns.length === 0 && !session) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">{t('BiChat.Input.Processing')}</div>
      </div>
    );
  }

  // Show welcome screen for new sessions with no turns
  const showWelcome = !session && turns.length === 0;
  const activeSessionId =
    session?.id ||
    (currentSessionId && currentSessionId !== 'new'
      ? currentSessionId
      : undefined);

  const supportsArtifactsPanel = typeof dataSource.fetchSessionArtifacts === 'function';
  const showArtifactsControls = Boolean(showArtifactsPanel && supportsArtifactsPanel && activeSessionId);
  const shouldRenderArtifactsPanel = Boolean(
    showArtifactsControls && artifactsPanelExpanded && !showWelcome && activeSessionId
  );

  const handlePromptSelect = (prompt: string) => {
    setMessage(prompt);
  };

  const handleToggleArtifactsPanel = () => {
    const nextValue = !artifactsPanelExpanded;
    setArtifactsPanelExpanded(nextValue);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(artifactsPanelStorageKey, nextValue ? 'true' : 'false');
      if (nextValue) {
        window.dispatchEvent(new CustomEvent('bichat:artifacts-panel-expanded', { detail: { expanded: true } }));
      }
    }
  };

  const canShowShareButton = Boolean(
    session?.access?.canManageMembers
    && dataSource.listUsers
    && dataSource.listSessionMembers
    && dataSource.addSessionMember
    && dataSource.updateSessionMemberRole
    && dataSource.removeSessionMember
  );

  const shareButton = canShowShareButton ? (
    <button
      type="button"
      onClick={() => setMembersModalOpen(true)}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-all duration-150 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      aria-label={t('BiChat.Share.Title')}
      title={t('BiChat.Share.Title')}
    >
      <Users className="h-4 w-4" />
      {t('BiChat.Share.Button')}
    </button>
  ) : null;

  const headerActions = (
    <>
      {shareButton}
      {showArtifactsControls && (
        <button
          type="button"
          onClick={handleToggleArtifactsPanel}
          className={[
            'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
            artifactsPanelExpanded
              ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/30 dark:text-primary-300 dark:hover:bg-primary-900/40'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
          ].join(' ')}
          aria-label={artifactsPanelExpanded ? t('BiChat.Artifacts.ToggleHide') : t('BiChat.Artifacts.ToggleShow')}
          aria-expanded={artifactsPanelExpanded}
          title={artifactsPanelExpanded ? t('BiChat.Artifacts.ToggleHide') : t('BiChat.Artifacts.ToggleShow')}
        >
          <Sidebar className="h-4 w-4" weight={artifactsPanelExpanded ? 'duotone' : 'regular'} />
          {t('BiChat.Artifacts.Title')}
        </button>
      )}
      {actionsSlot}
    </>
  );

  return (
    <main
      className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-900 ${className}`}
    >
      {headerSlot || (
        <ChatHeader
          session={session}
          onBack={onBack}
          readOnly={effectiveReadOnly}
          logoSlot={logoSlot}
          actionsSlot={headerActions}
          members={session?.owner ? [session.owner] : undefined}
          onMembersClick={canShowShareButton ? () => setMembersModalOpen(true) : undefined}
        />
      )}
      {error && (
        <Alert
          variant={errorRetryable ? 'warning' : 'error'}
          title={t('BiChat.Error.Generic')}
          message={error}
          onDismiss={() => setError(null)}
          onRetry={errorRetryable ? retryFetchSession : undefined}
        />
      )}

      <div
        ref={layoutContainerRef}
        className="relative flex min-h-0 flex-1 overflow-hidden"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showWelcome ? (
            <div className="flex flex-1 flex-col overflow-auto">
              <div className="flex flex-1 items-center justify-center px-4 py-8">
                <div className="w-full max-w-5xl">
                  {welcomeSlot || (
                    <WelcomeContent onPromptSelect={handlePromptSelect} disabled={loading} />
                  )}
                  {streamError && (
                    <div className="px-6 pt-4">
                      <StreamError
                        error={streamError}
                        compact
                        onRetry={streamErrorRetryable ? () => void retryLastMessage() : undefined}
                        onDismiss={clearStreamError}
                      />
                    </div>
                  )}
                  {!effectiveReadOnly && (
                    <MessageInput
                      message={message}
                      loading={loading}
                      isStreaming={isStreaming}
                      fetching={fetching}
                      commandError={inputError}
                      onClearCommandError={() => setInputError(null)}
                      debugMode={debugMode}
                      debugSessionUsage={sessionDebugUsage}
                      debugLimits={debugLimits}
                      onMessageChange={setMessage}
                      onSubmit={handleSubmit}
                      messageQueue={messageQueue}
                      onUnqueue={handleUnqueue}
                      onRemoveQueueItem={removeQueueItem}
                      onUpdateQueueItem={updateQueueItem}
                      onCancelStreaming={cancel}
                      containerClassName="pt-6 px-6"
                      formClassName="mx-auto"
                    />
                  )}
                  <p className="mt-4 pb-1 text-center text-xs text-gray-500 dark:text-gray-400">
                    {t('BiChat.Welcome.Disclaimer')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {isArchived && (
                <ArchiveBanner
                  show
                  onRestore={handleRestore}
                  restoring={restoring}
                />
              )}
              <MessageList
                renderUserTurn={renderUserTurn}
                renderAssistantTurn={renderAssistantTurn}
                thinkingVerbs={thinkingVerbs}
                readOnly={effectiveReadOnly}
              />
              <AnimatePresence>
                {isCompacting && (
                  <div className="flex justify-center px-4 pb-2">
                    <CompactionDoodle
                      title={t('BiChat.Slash.CompactingTitle')}
                      subtitle={t('BiChat.Slash.CompactingSubtitle')}
                    />
                  </div>
                )}
              </AnimatePresence>
              {streamError && (
                <div className="px-4 pb-2">
                  <StreamError
                    error={streamError}
                    compact
                    onRetry={streamErrorRetryable ? () => void retryLastMessage() : undefined}
                    onDismiss={clearStreamError}
                  />
                </div>
              )}
              {!effectiveReadOnly && (
                <MessageInput
                  message={message}
                  loading={loading}
                  isStreaming={isStreaming}
                  fetching={fetching}
                  commandError={inputError}
                  onClearCommandError={() => setInputError(null)}
                  debugMode={debugMode}
                  debugSessionUsage={sessionDebugUsage}
                  debugLimits={debugLimits}
                  onMessageChange={setMessage}
                  onSubmit={handleSubmit}
                  messageQueue={messageQueue}
                  onUnqueue={handleUnqueue}
                  onRemoveQueueItem={removeQueueItem}
                  onUpdateQueueItem={updateQueueItem}
                  onCancelStreaming={cancel}
                />
              )}
            </>
          )}
        </div>

        {/* Desktop: persistent slot with animated width so main content expands in sync */}
        <motion.div
          className="hidden lg:flex lg:min-h-0 shrink-0 overflow-hidden"
          animate={{
            width: shouldRenderArtifactsPanel && activeSessionId ? artifactsPanelWidth : 0,
          }}
          transition={
            isResizingArtifactsPanel
              ? { duration: 0 }
              : { type: 'spring', stiffness: 320, damping: 32 }
          }
        >
          {shouldRenderArtifactsPanel && activeSessionId && (
            <motion.div
              className="flex min-h-0"
              style={{ width: artifactsPanelWidth }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div
                role="separator"
                tabIndex={0}
                aria-label={t('BiChat.Artifacts.Resize')}
                aria-orientation="vertical"
                aria-valuenow={artifactsPanelWidth}
                aria-valuemin={ARTIFACTS_PANEL_WIDTH_MIN}
                aria-valuemax={ARTIFACTS_PANEL_WIDTH_MAX}
                onMouseDown={handleArtifactsResizeStart}
                onKeyDown={handleArtifactsResizeKeyDown}
                className="relative flex shrink-0 cursor-col-resize touch-none items-center justify-center w-2 transition-colors lg:flex group/resize after:absolute after:inset-y-0 after:left-0 after:w-0.5 after:bg-gray-300 dark:after:bg-gray-600 after:transition-colors group-hover/resize:after:bg-primary-400 dark:group-hover/resize:after:bg-primary-500 focus-visible:outline-none focus-visible:after:bg-primary-500 dark:focus-visible:after:bg-primary-400"
              >
                <span className="absolute h-10 w-1.5 cursor-col-resize rounded-full bg-gray-400 transition-colors group-hover/resize:bg-primary-400 dark:bg-gray-500 dark:group-hover/resize:bg-primary-500" />
              </div>
              <SessionArtifactsPanel
                dataSource={dataSource}
                sessionId={activeSessionId}
                isStreaming={isStreaming}
                allowDrop={!effectiveReadOnly}
                className="min-h-0 min-w-0 flex-1"
              />
            </motion.div>
          )}
        </motion.div>

        <AnimatePresence>
          {shouldRenderArtifactsPanel && activeSessionId && (
            <motion.div
              key="artifacts-mobile"
              className="fixed inset-0 z-40 flex lg:hidden"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              role="dialog"
              aria-modal="true"
            >
              <motion.button
                type="button"
                className="cursor-pointer flex-1 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleToggleArtifactsPanel}
                aria-label={t('BiChat.Common.Close')}
              />
              <SessionArtifactsPanel
                dataSource={dataSource}
                sessionId={activeSessionId}
                isStreaming={isStreaming}
                allowDrop={!effectiveReadOnly}
                className="flex h-full w-full max-w-sm min-h-0"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <SessionMembersModal
        isOpen={membersModalOpen}
        sessionId={session?.id}
        dataSource={dataSource}
        onClose={() => setMembersModalOpen(false)}
      />
    </main>
  );
}

export function ChatSession(props: ChatSessionProps) {
  const { dataSource, sessionId, rateLimiter, onSessionCreated, ...coreProps } = props;

  return (
    <ChatSessionProvider
      dataSource={dataSource}
      sessionId={sessionId}
      rateLimiter={rateLimiter}
      onSessionCreated={onSessionCreated}
    >
      <ChatSessionCore dataSource={dataSource} {...coreProps} />
    </ChatSessionProvider>
  );
}

export type { ChatSessionProps };
