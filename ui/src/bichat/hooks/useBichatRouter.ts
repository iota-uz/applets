/**
 * Router adapter for BiChat sidebar and archived list.
 * Consumes a navigate function and location (pathname) and returns
 * activeSessionId plus callbacks for use with SDK Sidebar and ArchivedChatList.
 *
 * Router-agnostic: pass useNavigate()/useLocation() from react-router-dom
 * or equivalent from your router.
 */

import { useMemo, useCallback } from 'react';

export interface UseBichatRouterParams {
  /** Navigate to a path (e.g. from useNavigate()) */
  navigate: (path: string) => void;
  /** Current pathname (e.g. location.pathname from useLocation()) */
  pathname: string;
  /** Optional: close mobile sidebar after navigation (e.g. closeMobile from useSidebarState) */
  onNavigate?: () => void;
}

export interface UseBichatRouterReturn {
  /** Session ID extracted from pathname (e.g. /session/:id -> id) */
  activeSessionId: string | undefined;
  /** Navigate to session or home when sessionId is empty */
  onSessionSelect: (sessionId: string) => void;
  /** Navigate to new chat (home) */
  onNewChat: () => void;
  /** Navigate to archived list */
  onArchivedView: () => void;
  /** Navigate back (e.g. to home) */
  onBack: () => void;
}

const SESSION_PATH_REGEX = /\/session\/([^/]+)/;

/**
 * Derives BiChat navigation callbacks and activeSessionId from router state.
 * Use with SDK Sidebar (onSessionSelect, onNewChat, onArchivedView, activeSessionId)
 * and ArchivedChatList (onBack, onSessionSelect).
 */
export function useBichatRouter({
  navigate,
  pathname,
  onNavigate,
}: UseBichatRouterParams): UseBichatRouterReturn {
  const activeSessionId = useMemo(
    () => pathname.match(SESSION_PATH_REGEX)?.[1],
    [pathname]
  );

  const maybeClose = useCallback(() => {
    onNavigate?.();
  }, [onNavigate]);

  const onSessionSelect = useCallback(
    (sessionId: string) => {
      if (sessionId) {
        navigate(`/session/${sessionId}`);
      } else {
        navigate('/');
      }
      maybeClose();
    },
    [navigate, maybeClose]
  );

  const onNewChat = useCallback(() => {
    navigate('/');
    maybeClose();
  }, [navigate, maybeClose]);

  const onArchivedView = useCallback(() => {
    navigate('/archived');
    maybeClose();
  }, [navigate, maybeClose]);

  const onBack = useCallback(() => {
    navigate('/');
    maybeClose();
  }, [navigate, maybeClose]);

  return {
    activeSessionId,
    onSessionSelect,
    onNewChat,
    onArchivedView,
    onBack,
  };
}
