/**
 * useMessageListScroll — scroll management for the MessageList.
 *
 * Owns: auto-scroll, initial-session scroll, scroll-to-bottom button,
 * unread-count tracking, and the End-key shortcut.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useKeyboardShortcuts, type ShortcutConfig } from './useKeyboardShortcuts';

const NEAR_BOTTOM_PX = 150;

export interface MessageListScrollOptions {
  /** Current session id — triggers initial scroll on change. */
  currentSessionId: string | undefined
  /** True while session data is loading. */
  fetching: boolean
  /** Number of conversation turns (triggers auto-scroll). */
  turnsLength: number
  /** Current streaming content (controls instant vs smooth scroll). */
  streamingContent: string
}

export interface MessageListScrollReturn {
  containerRef: React.RefObject<HTMLDivElement>
  messagesEndRef: React.RefObject<HTMLDivElement>
  showScrollButton: boolean
  unreadCount: number
  handleScrollToBottom: () => void
}

export function useMessageListScroll({
  currentSessionId,
  fetching,
  turnsLength,
  streamingContent,
}: MessageListScrollOptions): MessageListScrollReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialScrollSessionRef = useRef<string | undefined>(undefined);
  const prevTurnsLengthRef = useRef(turnsLength);
  const isAutoScrollRef = useRef(true);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // -- Core scroll helper ---------------------------------------------------

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // -- Auto-scroll on new turns / streaming ---------------------------------

  useEffect(() => {
    if (!isAutoScrollRef.current) {return;}
    scrollToBottom(streamingContent ? 'auto' : 'smooth');
  }, [turnsLength, streamingContent, scrollToBottom]);

  // -- Initial scroll when opening a session --------------------------------

  useEffect(() => {
    if (fetching || !currentSessionId || currentSessionId === 'new') {return;}
    if (initialScrollSessionRef.current === currentSessionId) {return;}

    const runInitialScroll = () => {
      scrollToBottom('auto');
      setShowScrollButton(false);
      isAutoScrollRef.current = true;
    };

    requestAnimationFrame(() => requestAnimationFrame(runInitialScroll));
    const t1 = setTimeout(runInitialScroll, 80);
    const t2 = setTimeout(runInitialScroll, 200);
    const t3 = setTimeout(runInitialScroll, 400);

    initialScrollSessionRef.current = currentSessionId;
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [currentSessionId, fetching, turnsLength, scrollToBottom]);

  // -- Scroll detection — button visibility + auto-scroll flag --------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {return;}

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_PX;
      isAutoScrollRef.current = nearBottom;
      setShowScrollButton(!nearBottom);
      if (nearBottom) {setUnreadCount(0);}
    };

    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // -- Unread tracking when scrolled up -------------------------------------

  useEffect(() => {
    const prev = prevTurnsLengthRef.current;
    prevTurnsLengthRef.current = turnsLength;
    if (turnsLength > prev && showScrollButton) {
      setUnreadCount(c => c + (turnsLength - prev));
    }
  }, [turnsLength, showScrollButton]);

  // -- End-key shortcut -----------------------------------------------------

  const shortcuts = useMemo<ShortcutConfig[]>(() => [{
    key: 'End',
    callback: () => { scrollToBottom('smooth'); setUnreadCount(0); },
    description: 'Scroll to bottom',
  }], [scrollToBottom]);
  useKeyboardShortcuts(shortcuts);

  // -- Public callback for the button ---------------------------------------

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom('smooth');
    setUnreadCount(0);
  }, [scrollToBottom]);

  return { containerRef, messagesEndRef, showScrollButton, unreadCount, handleScrollToBottom };
}
