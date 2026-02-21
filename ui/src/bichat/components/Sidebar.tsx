/**
 * Sidebar Component
 * Main chat sidebar with session list, search, and session management.
 * Router-agnostic: uses callbacks for navigation instead of react-router-dom.
 *
 * Collapse UX (matches SDK sidebar pattern):
 * - Click empty space to toggle
 * - Cursor hints (e-resize / w-resize)
 * - localStorage persistence
 * - Keyboard shortcut: Cmd+B toggle
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { X, Plus, Archive, CaretLineLeft, CaretLineRight, Gear, Users, List, ChatCircle, MagnifyingGlass } from '@phosphor-icons/react'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import SessionSkeleton from './SessionSkeleton'
import SessionItem from './SessionItem'
import ConfirmModal from './ConfirmModal'
import SearchInput from './SearchInput'
import DateGroupHeader from './DateGroupHeader'
import { EmptyState } from './EmptyState'
import LoadingSpinner from './LoadingSpinner'
import AllChatsList from './AllChatsList'
import { useTranslation } from '../hooks/useTranslation'
import { useToast } from '../hooks/useToast'
import { groupSessionsByDate } from '../utils/sessionGrouping'
import {
  staggerContainerVariants,
  buttonVariants,
} from '../animations/variants'
import type { Session, ChatDataSource } from '../types'
import { ToastContainer } from './ToastContainer'
import { toErrorDisplay, type RPCErrorDisplay } from '../utils/errorDisplay'

function ErrorAlert({ error }: { error: RPCErrorDisplay }) {
  const amber = error.isPermissionDenied
  return (
    <div
      className={`mx-2 mt-4 p-3 border rounded-xl cursor-default ${
        amber
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`}
    >
      <p
        className={`text-xs font-medium ${
          amber
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-red-600 dark:text-red-400'
        }`}
      >
        {error.title}
      </p>
      {error.description && (
        <p
          className={`mt-1 text-xs ${
            amber
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-500 dark:text-red-300'
          }`}
        >
          {error.description}
        </p>
      )}
    </div>
  )
}

const COLLAPSE_STORAGE_KEY = 'bichat-sidebar-collapsed'
const SESSION_RECONCILE_POLL_INTERVAL_MS = 2000
const SESSION_RECONCILE_MAX_POLLS = 30
const ACTIVE_SESSION_MISS_MAX_RETRIES = 8
const ACTIVE_SESSION_MISS_RETRY_DELAY_MS = 1000

function useSidebarCollapse() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const isCollapsedRef = useRef(isCollapsed)
  useEffect(() => {
    isCollapsedRef.current = isCollapsed
  }, [isCollapsed])

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next)) } catch { /* noop */ }
      return next
    })
  }, [])

  const expand = useCallback(() => {
    setIsCollapsed(false)
    try { localStorage.setItem(COLLAPSE_STORAGE_KEY, 'false') } catch { /* noop */ }
  }, [])

  const collapse = useCallback(() => {
    setIsCollapsed(true)
    try { localStorage.setItem(COLLAPSE_STORAGE_KEY, 'true') } catch { /* noop */ }
  }, [])

  return { isCollapsed, isCollapsedRef, toggle, expand, collapse }
}

type ActiveTab = 'my-chats' | 'all-chats'

export interface SidebarProps {
  dataSource: ChatDataSource
  onSessionSelect: (sessionId: string) => void
  onNewChat: () => void
  onArchivedView?: () => void
  activeSessionId?: string
  creating?: boolean
  showAllChatsTab?: boolean
  isOpen?: boolean
  onClose?: () => void
  headerSlot?: React.ReactNode
  footerSlot?: React.ReactNode
  className?: string
}

export default function Sidebar({
  dataSource,
  onSessionSelect,
  onNewChat,
  onArchivedView,
  activeSessionId,
  creating,
  showAllChatsTab,
  isOpen: _isOpen,
  onClose,
  headerSlot,
  footerSlot,
  className = '',
}: SidebarProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const shouldReduceMotion = useReducedMotion()
  const sessionListRef = useRef<HTMLElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const activeSessionMissRetriesRef = useRef<Record<string, number>>({})

  // Collapse state — disabled when used as a mobile drawer (onClose present)
  const { isCollapsed, toggle, expand, collapse } = useSidebarCollapse()
  const collapsible = !onClose // desktop only

  // Click-on-empty-space to toggle (same pattern as SDK sidebar)
  const handleSidebarClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!collapsible) return
      const interactive = 'a, button, input, textarea, select, summary, label, [role="button"], [role="link"], [contenteditable="true"], [data-no-sidebar-toggle]'
      if ((e.target as HTMLElement).closest(interactive)) return
      toggle()
    },
    [collapsible, toggle]
  )

  // Keyboard shortcut: Cmd+B (toggle)
  useEffect(() => {
    if (!collapsible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'b') {
        e.preventDefault()
        toggle()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [collapsible, toggle])

  // Auto-collapse when artifacts panel expands
  useEffect(() => {
    if (!collapsible) return

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ expanded: boolean }>).detail
      if (detail?.expanded) {
        collapse()
      }
    }
    window.addEventListener('bichat:artifacts-panel-expanded', handler)
    return () => window.removeEventListener('bichat:artifacts-panel-expanded', handler)
  }, [collapsible, collapse])

  const showCollapsed = collapsible && isCollapsed

  // Allow tooltips to escape sidebar bounds once collapse transition settles
  const [collapsedOverflowVisible, setCollapsedOverflowVisible] = useState(false)
  useEffect(() => {
    if (!showCollapsed) {
      setCollapsedOverflowVisible(false)
      return
    }
    const timer = setTimeout(() => setCollapsedOverflowVisible(true), 300)
    return () => clearTimeout(timer)
  }, [showCollapsed])

  // View state (my chats vs all chats)
  const [activeTab, setActiveTab] = useState<ActiveTab>('my-chats')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Session data
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<RPCErrorDisplay | null>(null)
  const [actionError, setActionError] = useState<RPCErrorDisplay | null>(null)
  const accessDenied = loadError?.isPermissionDenied === true

  // Refresh key — bump to re-fetch sessions
  const [refreshKey, setRefreshKey] = useState(0)
  const [reconcilePollToken, setReconcilePollToken] = useState(0)

  // Confirm modal state
  const [showConfirm, setShowConfirm] = useState(false)
  const [sessionToArchive, setSessionToArchive] = useState<string | null>(null)

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)
      setActionError(null)
      const result = await dataSource.listSessions({ limit: 50 })
      setSessions(result.sessions)
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setLoadError(toErrorDisplay(err, t('BiChat.Sidebar.FailedToLoadSessions')))
    } finally {
      setLoading(false)
    }
  }, [dataSource, t])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions, refreshKey])

  useEffect(() => {
    const handleSessionsUpdated = (event: Event) => {
      setRefreshKey((k) => k + 1)

      const detail = (event as CustomEvent<{ reason?: string }>).detail
      const reason = detail?.reason
      if (!reason || reason === 'session_created' || reason === 'message_sent' || reason === 'title_regenerate_requested') {
        setReconcilePollToken((k) => k + 1)
      }
    }

    window.addEventListener('bichat:sessions-updated', handleSessionsUpdated)
    return () => {
      window.removeEventListener('bichat:sessions-updated', handleSessionsUpdated)
    }
  }, [])

  useEffect(() => {
    activeSessionMissRetriesRef.current = {}
  }, [activeSessionId])

  useEffect(() => {
    if (!activeSessionId) return
    if (loading) return

    const hasActiveSession = sessions.some((session) => session.id === activeSessionId)
    if (hasActiveSession) {
      delete activeSessionMissRetriesRef.current[activeSessionId]
      return
    }

    const attempts = activeSessionMissRetriesRef.current[activeSessionId] ?? 0
    if (attempts >= ACTIVE_SESSION_MISS_MAX_RETRIES) {
      return
    }
    activeSessionMissRetriesRef.current[activeSessionId] = attempts + 1

    const timeoutId = window.setTimeout(() => {
      setRefreshKey((k) => k + 1)
      setReconcilePollToken((k) => k + 1)
    }, ACTIVE_SESSION_MISS_RETRY_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [activeSessionId, loading, sessions])

  // Poll for title updates on sessions with placeholder titles.
  // Use a stable boolean so that updating sessions inside the poll
  // does NOT re-trigger the effect (which would create overlapping intervals).
  const hasPlaceholderTitles = useMemo(() => {
    const newChatLabel = t('BiChat.Chat.NewChat')
    return (
      Array.isArray(sessions) &&
      sessions.some((s) => s && (!s.title || s.title === newChatLabel))
    )
  }, [sessions, t])

  useEffect(() => {
    if (!hasPlaceholderTitles && reconcilePollToken === 0) return

    let pollCount = 0

    const intervalId = setInterval(async () => {
      pollCount++
      try {
        const result = await dataSource.listSessions({ limit: 50 })
        setSessions(result.sessions)
      } catch {
        // ignore poll errors
      }
      if (pollCount >= SESSION_RECONCILE_MAX_POLLS) {
        clearInterval(intervalId)
      }
    }, SESSION_RECONCILE_POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [hasPlaceholderTitles, dataSource, reconcilePollToken])

  const handleArchiveRequest = (sessionId: string) => {
    setSessionToArchive(sessionId)
    setShowConfirm(true)
  }

  const handleUndoArchive = useCallback(async (sessionId: string) => {
    try {
      await dataSource.unarchiveSession(sessionId)
      setRefreshKey((k) => k + 1)
      window.dispatchEvent(new CustomEvent('bichat:sessions-updated', {
        detail: { reason: 'unarchived', sessionId },
      }))
    } catch (undoErr) {
      console.error('Failed to restore session:', undoErr)
      toast.error(t('BiChat.Sidebar.FailedToRestoreChat'))
    }
  }, [dataSource, t, toast])

  const confirmArchive = async () => {
    if (!sessionToArchive) return

    const wasCurrentSession = activeSessionId === sessionToArchive
    const archivedId = sessionToArchive

    try {
      await dataSource.archiveSession(archivedId)
      setRefreshKey((k) => k + 1)
      window.dispatchEvent(new CustomEvent('bichat:sessions-updated', {
        detail: { reason: 'archived', sessionId: archivedId },
      }))

      if (wasCurrentSession) {
        onSessionSelect('')
      }

      toast.success(t('BiChat.Sidebar.ChatArchived'), 8000, {
        label: t('BiChat.Common.Undo'),
        onClick: () => handleUndoArchive(archivedId),
      })
    } catch (err) {
      console.error('Failed to archive session:', err)
      const display = toErrorDisplay(err, t('BiChat.Sidebar.FailedToArchiveChat'))
      setActionError(display)
      toast.error(display.title)
    } finally {
      setShowConfirm(false)
      setSessionToArchive(null)
    }
  }

  const handleTogglePin = async (
    sessionId: string,
    currentlyPinned: boolean
  ) => {
    try {
      if (currentlyPinned) {
        await dataSource.unpinSession(sessionId)
      } else {
        await dataSource.pinSession(sessionId)
      }
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('Failed to toggle pin:', err)
      const display = toErrorDisplay(err, t('BiChat.Sidebar.FailedToTogglePin'))
      setActionError(display)
      toast.error(display.title)
    }
  }

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      await dataSource.renameSession(sessionId, newTitle)
      toast.success(t('BiChat.Sidebar.ChatRenamedSuccessfully'))
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('Failed to update session title:', err)
      const display = toErrorDisplay(err, t('BiChat.Sidebar.FailedToRenameChat'))
      setActionError(display)
      toast.error(display.title)
    }
  }

  const handleRegenerateTitle = async (sessionId: string) => {
    try {
      await dataSource.regenerateSessionTitle(sessionId)
      toast.success(t('BiChat.Sidebar.TitleRegenerated'))
      window.dispatchEvent(new CustomEvent('bichat:sessions-updated', {
        detail: { reason: 'title_regenerate_requested', sessionId },
      }))
    } catch (err) {
      console.error('Failed to regenerate title:', err)
      const display = toErrorDisplay(err, t('BiChat.Sidebar.FailedToRegenerateTitle'))
      setActionError(display)
      toast.error(display.title)
    }
  }

  // Stable callbacks for SessionItem — accept session ID as parameter
  const handleSessionSelect = useCallback(
    (sessionId: string) => onSessionSelect(sessionId),
    [onSessionSelect],
  )
  const handleSessionArchive = useCallback(
    (sessionId: string) => handleArchiveRequest(sessionId),
    [],
  )
  const handleSessionPin = useCallback(
    (sessionId: string, pinned: boolean) => handleTogglePin(sessionId, pinned),
    [handleTogglePin],
  )
  const handleSessionRename = useCallback(
    (sessionId: string, newTitle: string) => handleRenameSession(sessionId, newTitle),
    [handleRenameSession],
  )
  const handleSessionRegenerateTitle = useCallback(
    (sessionId: string) => handleRegenerateTitle(sessionId),
    [handleRegenerateTitle],
  )

  // Filter sessions by search
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter((s) => s.title?.toLowerCase().includes(q))
  }, [sessions, searchQuery])

  // Separate pinned and unpinned
  const pinnedSessions = useMemo(
    () => filteredSessions.filter((s) => s.pinned),
    [filteredSessions]
  )
  const unpinnedSessions = useMemo(
    () => filteredSessions.filter((s) => !s.pinned),
    [filteredSessions]
  )

  // Group unpinned sessions by date
  const sessionGroups = useMemo(() => {
    const groups = groupSessionsByDate(unpinnedSessions, t)
    return Array.isArray(groups)
      ? groups.map((group) => ({
          ...group,
          sessions: Array.isArray(group.sessions) ? group.sessions : [],
        }))
      : []
  }, [unpinnedSessions, t])

  // Collapsed sidebar indicators — pinned first, then most recent
  const MAX_COLLAPSED_INDICATORS = 5
  const collapsedIndicators = useMemo(() => {
    const seen = new Set<string>()
    const result: Session[] = []
    for (const s of [...pinnedSessions, ...unpinnedSessions]) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      result.push(s)
      if (result.length >= MAX_COLLAPSED_INDICATORS) break
    }
    return result
  }, [pinnedSessions, unpinnedSessions])

  const totalSessionCount = sessions.length
  const overflowCount = totalSessionCount - collapsedIndicators.length

  // Keyboard navigation for session list (WAI-ARIA listbox pattern)
  const handleSessionListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const nav = sessionListRef.current
      if (!nav) return

      const focusableItems = Array.from(
        nav.querySelectorAll<HTMLElement>('button[data-session-item]')
      )
      if (focusableItems.length === 0) return

      const currentIndex = focusableItems.indexOf(
        document.activeElement as HTMLElement
      )

      let nextIndex: number | null = null

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          nextIndex =
            currentIndex < 0 ? 0 : Math.min(currentIndex + 1, focusableItems.length - 1)
          break
        case 'ArrowUp':
          e.preventDefault()
          nextIndex =
            currentIndex < 0
              ? focusableItems.length - 1
              : Math.max(currentIndex - 1, 0)
          break
        case 'Home':
          e.preventDefault()
          nextIndex = 0
          break
        case 'End':
          e.preventDefault()
          nextIndex = focusableItems.length - 1
          break
      }

      if (nextIndex !== null) {
        focusableItems[nextIndex].focus()
      }
    },
    []
  )

  return (
    <>
      <aside
        onClick={collapsible ? handleSidebarClick : undefined}
        className={`relative bg-surface-300 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 h-full min-h-0 flex flex-col ${collapsedOverflowVisible ? 'overflow-visible' : 'overflow-hidden'} transition-[width] duration-300 ease-in-out ${
          showCollapsed
            ? 'w-16 cursor-e-resize'
            : collapsible
              ? 'w-64 cursor-w-resize'
              : 'w-64'
        } ${className}`}
        style={{ willChange: 'width' }}
        role="navigation"
        aria-label={t('BiChat.Sidebar.ChatSessions')}
      >
        {/* Collapsed overlay — absolutely positioned, fades in after width shrinks */}
        {collapsible && (
          <div
            className={`absolute inset-x-0 top-0 bottom-0 z-10 flex flex-col items-center pt-3 gap-3 transition-opacity ${
              showCollapsed
                ? 'opacity-100 duration-150 delay-100'
                : 'opacity-0 pointer-events-none duration-100'
            }`}
          >
            <div className="group/tooltip relative">
              <motion.button
                onClick={(e) => {
                  e.stopPropagation()
                  onNewChat()
                }}
                disabled={creating || loading || accessDenied}
                className="w-10 h-10 rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-sm flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-400/50"
                title={t('BiChat.Chat.NewChat')}
                aria-label={t('BiChat.Sidebar.CreateNewChat')}
                whileTap={{ scale: 0.95 }}
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus size={18} weight="bold" />
                )}
              </motion.button>
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 rounded-md bg-gray-900 dark:bg-gray-100 px-2 py-1 text-xs font-medium text-white dark:text-gray-900 opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                {t('BiChat.Chat.NewChat')}
              </span>
            </div>

            {/* Search button — expands sidebar and focuses search */}
            <div className="group/search relative">
              <motion.button
                onClick={(e) => {
                  e.stopPropagation()
                  expand()
                  setTimeout(() => {
                    const input = searchContainerRef.current?.querySelector('input')
                    input?.focus()
                  }, 350)
                }}
                className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:outline-none"
                aria-label={t('BiChat.Sidebar.SearchChats')}
                whileTap={{ scale: 0.95 }}
              >
                <MagnifyingGlass size={18} />
              </motion.button>
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 rounded-md bg-gray-900 dark:bg-gray-100 px-2 py-1 text-xs font-medium text-white dark:text-gray-900 opacity-0 group-hover/search:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                {t('BiChat.Sidebar.SearchChats')}
              </span>
            </div>

            {/* Session indicators */}
            {collapsedIndicators.length > 0 && (
              <motion.div
                className="flex flex-col items-center gap-1.5 mt-1"
                variants={shouldReduceMotion ? undefined : staggerContainerVariants}
                initial="hidden"
                animate={showCollapsed ? 'visible' : 'hidden'}
              >
                {collapsedIndicators.map((session) => {
                  const isActive = session.id === activeSessionId
                  const initial = session.title?.trim()?.[0]?.toUpperCase()
                  return (
                    <motion.div
                      key={session.id}
                      className="group/indicator relative"
                      variants={
                        shouldReduceMotion
                          ? undefined
                          : {
                              hidden: { opacity: 0, scale: 0.8 },
                              visible: { opacity: 1, scale: 1 },
                            }
                      }
                    >
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSessionSelect(session.id)
                        }}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:outline-none ${
                          isActive
                            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500 dark:ring-primary-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        aria-label={session.title || t('BiChat.Chat.NewChat')}
                        whileTap={{ scale: 0.95 }}
                      >
                        {initial ? (
                          initial
                        ) : (
                          <ChatCircle size={16} weight="fill" />
                        )}
                      </motion.button>
                      <div className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 w-52 rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-xs font-medium text-white dark:text-gray-900 opacity-0 group-hover/indicator:opacity-100 transition-opacity shadow-lg break-words">
                        {session.title || t('BiChat.Chat.NewChat')}
                      </div>
                    </motion.div>
                  )
                })}
                {overflowCount > 0 && (
                  <motion.div
                    className="group/overflow relative"
                    variants={
                      shouldReduceMotion
                        ? undefined
                        : {
                            hidden: { opacity: 0, scale: 0.8 },
                            visible: { opacity: 1, scale: 1 },
                          }
                    }
                  >
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggle()
                      }}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-semibold bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:outline-none"
                      aria-label={t('BiChat.Sidebar.ChatSessions')}
                      whileTap={{ scale: 0.95 }}
                    >
                      +{overflowCount}
                    </motion.button>
                    <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 rounded-md bg-gray-900 dark:bg-gray-100 px-2 py-1 text-xs font-medium text-white dark:text-gray-900 opacity-0 group-hover/overflow:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                      {t('BiChat.Sidebar.ChatSessions')}
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* Expanded content — fades out before width shrinks */}
        <div
          className={`flex flex-col flex-1 min-h-0 w-64 shrink-0 transition-opacity ${
            showCollapsed
              ? 'opacity-0 pointer-events-none duration-100'
              : collapsible
                ? 'opacity-100 duration-150 delay-[200ms]'
                : ''
          }`}
        >
          {/* Header — only rendered when there is content to show */}
          {(headerSlot || onClose) && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              {headerSlot}
              {onClose && (
                <motion.button
                  onClick={onClose}
                  className="cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-smooth text-gray-600 dark:text-gray-400"
                  title={t('BiChat.Sidebar.CloseSidebar')}
                  aria-label={t('BiChat.Sidebar.CloseSidebar')}
                  whileHover="hover"
                  whileTap="tap"
                  variants={buttonVariants}
                >
                  <X size={20} className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          )}

          {/* Conditional content based on active view */}
          {activeTab === 'all-chats' && showAllChatsTab ? (
            <AllChatsList
              dataSource={dataSource}
              onSessionSelect={onSessionSelect}
              activeSessionId={activeSessionId}
            />
          ) : (
            <>
              {/* Search Input */}
              <div ref={searchContainerRef} className="mt-3 px-4">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t('BiChat.Sidebar.SearchChats')}
                />
              </div>

              {/* New Chat Button */}
              <div className="p-4">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation()
                    onNewChat()
                  }}
                  disabled={creating || loading || accessDenied}
                  className="cursor-pointer w-full px-4 py-2.5 bg-primary-600 dark:bg-primary-700 text-white rounded-lg hover:bg-primary-700 hover:-translate-y-0.5 active:bg-primary-800 transition-all duration-150 font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                  title={accessDenied ? t('BiChat.Sidebar.MissingPermission') : t('BiChat.Chat.NewChat')}
                  aria-label={t('BiChat.Sidebar.CreateNewChat')}
                  whileHover={shouldReduceMotion ? {} : { y: -1 }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                >
                  {creating ? (
                    <>
                      <LoadingSpinner variant="spinner" size="sm" />
                      <span>{t('BiChat.Common.Creating')}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} weight="bold" />
                      <span>{t('BiChat.Chat.NewChat')}</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Chat History */}
              <nav
                ref={sessionListRef}
                className="flex-1 overflow-y-auto px-2 pb-4 hide-scrollbar"
                aria-label={t('BiChat.Sidebar.ChatHistory')}
                onKeyDown={handleSessionListKeyDown}
              >
                {loading && sessions.length === 0 ? (
                  <SessionSkeleton count={5} />
                ) : (
                  <>
                    {/* Pinned Sessions */}
                    {pinnedSessions.length > 0 && (
                      <div className="mb-4">
                        <DateGroupHeader
                          groupName={t('BiChat.Common.Pinned')}
                          count={pinnedSessions.length}
                        />
                        <motion.div
                          className="space-y-1 mt-2"
                          variants={staggerContainerVariants}
                          initial="hidden"
                          animate="visible"
                          role="list"
                          aria-label={t('BiChat.Sidebar.PinnedChats')}
                        >
                          {pinnedSessions.map((session) => (
                            <SessionItem
                              key={session.id}
                              session={session}
                              isActive={session.id === activeSessionId}
                              onSelect={() => handleSessionSelect(session.id)}
                              onArchive={() => handleSessionArchive(session.id)}
                              onPin={() => handleSessionPin(session.id, session.pinned)}
                              onRename={(newTitle) => handleSessionRename(session.id, newTitle)}
                              onRegenerateTitle={() => handleSessionRegenerateTitle(session.id)}
                            />
                          ))}
                        </motion.div>
                        <div className="border-b border-gray-200 dark:border-gray-700 my-3" />
                      </div>
                    )}

                    {/* Grouped Sessions by Date */}
                    {sessionGroups.map((group) => (
                      <div key={group.name} className="mb-4">
                        <DateGroupHeader
                          groupName={group.name}
                          count={group.sessions.length}
                        />
                        <motion.div
                          className="space-y-1 mt-2"
                          variants={staggerContainerVariants}
                          initial="hidden"
                          animate="visible"
                          role="list"
                          aria-label={`${group.name} chats`}
                        >
                          {group.sessions.map((session) => (
                            <SessionItem
                              key={session.id}
                              session={session}
                              isActive={session.id === activeSessionId}
                              onSelect={() => handleSessionSelect(session.id)}
                              onArchive={() => handleSessionArchive(session.id)}
                              onPin={() => handleSessionPin(session.id, session.pinned)}
                              onRename={(newTitle) => handleSessionRename(session.id, newTitle)}
                              onRegenerateTitle={() => handleSessionRegenerateTitle(session.id)}
                            />
                          ))}
                        </motion.div>
                      </div>
                    ))}

                    {/* Empty State */}
                    {filteredSessions.length === 0 && !loading && (
                      <EmptyState
                        title={
                          searchQuery
                            ? t('BiChat.Sidebar.NoChatsFound', { query: searchQuery })
                            : t('BiChat.Sidebar.NoChatsYet')
                        }
                        description={
                          searchQuery
                            ? undefined
                            : t('BiChat.Sidebar.CreateOneToGetStarted')
                        }
                        action={
                          searchQuery ? (
                            <button
                              onClick={() => setSearchQuery('')}
                              className="cursor-pointer text-sm text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              {t('BiChat.Common.Clear')}
                            </button>
                          ) : undefined
                        }
                      />
                    )}
                  </>
                )}

                {loadError && <ErrorAlert error={loadError} />}
                {actionError && !loadError && <ErrorAlert error={actionError} />}
              </nav>

              {/* Footer slot */}
              {footerSlot}
            </>
          )}

          {/* Footer — settings (left) + collapse toggle (right) */}
          {collapsible && (
            <div className="mt-auto border-t border-gray-100 dark:border-gray-800/80 px-4 py-3 flex items-center justify-between">
              {/* Gear settings menu */}
              {(onArchivedView || showAllChatsTab) ? (
                <Menu>
                  <MenuButton
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                    }}
                    disabled={loading || accessDenied}
                    className="flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 p-2"
                    aria-label={t('BiChat.Sidebar.Settings')}
                    title={t('BiChat.Sidebar.Settings')}
                  >
                    <Gear size={20} />
                  </MenuButton>
                  <MenuItems
                    anchor="top start"
                    className="w-48 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg rounded-xl shadow-lg border border-gray-200/80 dark:border-gray-700/60 z-[var(--bichat-z-dropdown,10)] [--anchor-gap:8px] mb-1 p-1.5"
                  >
                    {onArchivedView && (
                      <MenuItem>
                        {({ focus, close }) => (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onArchivedView()
                              close()
                            }}
                            className={`cursor-pointer flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 dark:text-gray-300 transition-colors ${
                              focus ? 'bg-gray-100 dark:bg-gray-800/70' : ''
                            }`}
                            aria-label={t('BiChat.Sidebar.ArchivedChats')}
                          >
                            <Archive size={16} className="text-gray-400 dark:text-gray-500" />
                            {t('BiChat.Sidebar.ArchivedChats')}
                          </button>
                        )}
                      </MenuItem>
                    )}
                    {showAllChatsTab && activeTab !== 'all-chats' && (
                      <MenuItem>
                        {({ focus, close }) => (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setActiveTab('all-chats')
                              close()
                            }}
                            className={`cursor-pointer flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 dark:text-gray-300 transition-colors ${
                              focus ? 'bg-gray-100 dark:bg-gray-800/70' : ''
                            }`}
                            aria-label={t('BiChat.Sidebar.AllChats')}
                          >
                            <Users size={16} className="text-gray-400 dark:text-gray-500" />
                            {t('BiChat.Sidebar.AllChats')}
                          </button>
                        )}
                      </MenuItem>
                    )}
                    {showAllChatsTab && activeTab === 'all-chats' && (
                      <MenuItem>
                        {({ focus, close }) => (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setActiveTab('my-chats')
                              close()
                            }}
                            className={`cursor-pointer flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 dark:text-gray-300 transition-colors ${
                              focus ? 'bg-gray-100 dark:bg-gray-800/70' : ''
                            }`}
                            aria-label={t('BiChat.Sidebar.MyChats')}
                          >
                            <List size={16} className="text-gray-400 dark:text-gray-500" />
                            {t('BiChat.Sidebar.MyChats')}
                          </button>
                        )}
                      </MenuItem>
                    )}
                  </MenuItems>
                </Menu>
              ) : (
                <div />
              )}

              {/* Collapse toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggle()
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                title={t('BiChat.Sidebar.CollapseSidebar')}
                aria-label={t('BiChat.Sidebar.CollapseSidebar')}
              >
                <CaretLineLeft size={16} />
                <span className="text-xs font-medium">{t('BiChat.Sidebar.Collapse')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Collapsed footer — expand button */}
        {collapsible && showCollapsed && (
          <div className="absolute bottom-0 inset-x-0 z-10 border-t border-gray-100 dark:border-gray-800/80 py-3 flex justify-center">
            <div className="group/tooltip relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggle()
                }}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                title={t('BiChat.Sidebar.ExpandSidebar')}
                aria-label={t('BiChat.Sidebar.ExpandSidebar')}
              >
                <CaretLineRight size={16} />
              </button>
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 rounded-md bg-gray-900 dark:bg-gray-100 px-2 py-1 text-xs font-medium text-white dark:text-gray-900 opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                {t('BiChat.Sidebar.Expand')}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Confirm Archive Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title={t('BiChat.Sidebar.ArchiveChatSession')}
        message={t('BiChat.Sidebar.ArchiveChatMessage')}
        confirmText={t('BiChat.Sidebar.ArchiveButton')}
        cancelText={t('BiChat.Common.Cancel')}
        isDanger={true}
        onConfirm={confirmArchive}
        onCancel={() => {
          setShowConfirm(false)
          setSessionToArchive(null)
        }}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </>
  )
}
