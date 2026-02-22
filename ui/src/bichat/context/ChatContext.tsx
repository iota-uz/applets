/**
 * Chat session context provider and hooks.
 *
 * Thin React wrapper around ChatMachine. All async logic (session fetch,
 * streaming, HITL, slash commands, queue, rate limiting) lives in the
 * framework-agnostic ChatMachine class.
 *
 * Split into 3 focused contexts to minimize re-renders:
 * - ChatSessionContext: session lifecycle (session, fetching, error, debug)
 * - ChatMessagingContext: turns + streaming + tool interactions
 * - ChatInputContext: input form state (message, inputError, queue)
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type {
  ChatDataSource,
  ChatSessionStateValue,
  ChatMessagingStateValue,
  ChatInputStateValue,
} from '../types';
import { RateLimiter, type RateLimiterConfig } from '../utils/RateLimiter';
import { ChatMachine } from '../machine/ChatMachine';

// ---------------------------------------------------------------------------
// Internal context — holds the machine instance
// ---------------------------------------------------------------------------

const MachineCtx = createContext<ChatMachine | null>(null);

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

export interface ChatSessionProviderProps {
  dataSource: ChatDataSource
  sessionId?: string
  /**
   * External rate limiter instance. Captured once at mount — changing this prop
   * after initial render has no effect. For most cases, use `rateLimitConfig`
   * instead and let the provider create the limiter internally.
   */
  rateLimiter?: RateLimiter
  /**
   * Configuration for the built-in rate limiter (ignored when `rateLimiter` is
   * provided). Captured once at mount — changing after initial render has no effect.
   */
  rateLimitConfig?: RateLimiterConfig
  /**
   * Called when the machine creates a new session (e.g. on first message in a
   * "new chat"). Use this to navigate your SPA router to the new session URL.
   *
   * Replaces the deprecated `dataSource.navigateToSession`.
   */
  onSessionCreated?: (sessionId: string) => void
  children: ReactNode
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimiterConfig = {
  maxRequests: 20,
  windowMs: 60000,
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ChatSessionProvider({
  dataSource,
  sessionId,
  rateLimiter: externalRateLimiter,
  rateLimitConfig,
  onSessionCreated,
  children,
}: ChatSessionProviderProps) {
  // Create machine once (stable across re-renders)
  const machineRef = useRef<ChatMachine | null>(null);
  if (!machineRef.current) {
    machineRef.current = new ChatMachine({
      dataSource,
      rateLimiter:
        externalRateLimiter ||
        new RateLimiter(rateLimitConfig || DEFAULT_RATE_LIMIT_CONFIG),
      onSessionCreated,
    });
  }
  const machine = machineRef.current;

  // Sync mutable config (dataSource, onSessionCreated) on every render
  useEffect(() => {
    machine.updateConfig({ dataSource, onSessionCreated });
  }, [machine, dataSource, onSessionCreated]);

  // Sync sessionId prop → machine
  useEffect(() => {
    machine.setSessionId(sessionId);
  }, [machine, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      machine.dispose();
    };
  }, [machine]);

  return (
    <MachineCtx.Provider value={machine}>
      {children}
    </MachineCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

function useMachine(): ChatMachine {
  const machine = useContext(MachineCtx);
  if (!machine) {
    throw new Error('Chat hooks must be used within ChatSessionProvider');
  }
  return machine;
}

// ---------------------------------------------------------------------------
// Public hooks (same signatures as before)
// ---------------------------------------------------------------------------

export function useChatSession(): ChatSessionStateValue {
  const machine = useMachine();
  return useSyncExternalStore(
    machine.subscribeSession,
    machine.getSessionSnapshot,
    machine.getSessionSnapshot, // SSR fallback
  );
}

export function useChatMessaging(): ChatMessagingStateValue {
  const machine = useMachine();
  return useSyncExternalStore(
    machine.subscribeMessaging,
    machine.getMessagingSnapshot,
    machine.getMessagingSnapshot,
  );
}

/** Returns messaging context or null when outside ChatSessionProvider. */
export function useOptionalChatMessaging(): ChatMessagingStateValue | null {
  const machine = useContext(MachineCtx);
  // Can't call useSyncExternalStore conditionally, so guard with machine presence
  const snapshot = useSyncExternalStore(
    machine ? machine.subscribeMessaging : noopSubscribe,
    machine ? machine.getMessagingSnapshot : nullSnapshot,
    machine ? machine.getMessagingSnapshot : nullSnapshot,
  );
  return machine ? snapshot : null;
}

export function useChatInput(): ChatInputStateValue {
  const machine = useMachine();
  return useSyncExternalStore(
    machine.subscribeInput,
    machine.getInputSnapshot,
    machine.getInputSnapshot,
  );
}

// Helpers for useOptionalChatMessaging (must call hooks unconditionally)
function noopSubscribe(): () => void { return () => {}; }
function nullSnapshot(): null { return null; }
