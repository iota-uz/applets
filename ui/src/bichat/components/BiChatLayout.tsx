/**
 * BiChatLayout Component
 * Full-page layout with responsive sidebar, mobile drawer, page transitions,
 * keyboard shortcuts (Cmd+N), and SkipLink accessibility.
 *
 * Router-agnostic: consumers provide renderSidebar, routeKey, and onNewChat callbacks.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { List } from '@phosphor-icons/react';
import SkipLink from './SkipLink';
import { useSidebarState, type UseSidebarStateReturn } from '../hooks/useSidebarState';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useKeyboardShortcuts, type ShortcutConfig } from '../hooks/useKeyboardShortcuts';
import { useTranslation } from '../hooks/useTranslation';

export interface SidebarDrawerProps {
  onClose?: () => void
}

export interface BiChatLayoutProps {
  /** Render function for the sidebar. Receives `{ onClose }` when in mobile drawer mode. */
  renderSidebar: (props: SidebarDrawerProps) => React.ReactNode
  /** Main page content */
  children: React.ReactNode
  /** Callback for Cmd+N keyboard shortcut */
  onNewChat?: () => void
  /** Key for AnimatePresence page transitions (e.g. location.pathname). Omit to disable transitions. */
  routeKey?: string
  /** Custom class for the root container */
  className?: string
}

export function BiChatLayout({
  renderSidebar,
  children,
  onNewChat,
  routeKey,
  className = '',
}: BiChatLayoutProps) {
  const { t } = useTranslation();
  const { isMobile, isMobileOpen, openMobile, closeMobile } = useSidebarState();
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap on mobile drawer
  useFocusTrap(drawerRef, isMobile && isMobileOpen, menuButtonRef.current);

  // Cmd+N keyboard shortcut
  const shortcuts = useMemo<ShortcutConfig[]>(() => {
    if (!onNewChat) {return [];}
    return [{ key: 'n', ctrl: true, callback: onNewChat, description: 'New chat' }];
  }, [onNewChat]);
  useKeyboardShortcuts(shortcuts);

  // Escape key closes mobile drawer
  useEffect(() => {
    if (!isMobile || !isMobileOpen) {return;}

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMobile();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeMobile, isMobile, isMobileOpen]);

  // Swipe-left to close drawer
  const handleDrawerDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -80) {
      closeMobile();
    }
  };

  // Page transition content
  const content = routeKey ? (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        className="flex flex-1 min-h-0"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  ) : (
    <div className="flex flex-1 min-h-0">{children}</div>
  );

  return (
    <div className={`relative flex flex-1 w-full h-full min-h-0 overflow-hidden ${className}`}>
      <SkipLink />

      {/* Sidebar — desktop */}
      <div className="hidden md:block">
        {renderSidebar({})}
      </div>

      {/* Sidebar — mobile drawer */}
      <AnimatePresence>
        {isMobile && isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sidebar-backdrop"
              className="fixed inset-0 z-[var(--bichat-z-overlay,30)] bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobile}
              aria-hidden="true"
            />
            {/* Drawer */}
            <motion.div
              key="sidebar-drawer"
              className="fixed inset-y-0 left-0 z-[var(--bichat-z-modal,40)] w-[18rem] max-w-[85vw] shadow-2xl"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: -120, right: 0 }}
              dragElastic={{ left: 0.2, right: 0 }}
              onDragEnd={handleDrawerDragEnd}
              onClick={(e) => e.stopPropagation()}
            >
              <div ref={drawerRef} className="h-full bg-white dark:bg-gray-900">
                {renderSidebar({ onClose: closeMobile })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main id="main-content" className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile menu button */}
        {isMobile && !isMobileOpen && (
          <button
            ref={menuButtonRef}
            onClick={openMobile}
            className="md:hidden absolute top-3 left-3 z-[var(--bichat-z-sticky,20)] w-10 h-10 rounded-xl bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 border border-gray-200/60 dark:border-gray-800/80 shadow-sm flex items-center justify-center hover:bg-white dark:hover:bg-gray-900 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-400/50"
            aria-label={t('BiChat.Layout.OpenSidebar')}
            title={t('BiChat.Layout.OpenSidebar')}
          >
            <List size={20} weight="bold" />
          </button>
        )}
        {content}
      </main>
    </div>
  );
}

// Re-export useSidebarState for consumers who want custom layout control
export { useSidebarState, type UseSidebarStateReturn };
