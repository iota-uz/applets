/**
 * SessionItem Component
 * Individual chat session item in the sidebar with actions menu
 * Router-agnostic: uses onSelect callback instead of Link
 */

import React, { useRef, memo, useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { DotsThree, Check, Bookmark, PencilSimple, Archive, ArrowsClockwise, ArrowUUpLeft, Trash } from '@phosphor-icons/react'
import { EditableText, type EditableTextRef } from './EditableText'
import { sessionItemVariants } from '../animations/variants'
import type { Session } from '../types'
import { useLongPress } from '../hooks/useLongPress'
import { TouchContextMenu, type ContextMenuItem } from './TouchContextMenu'
import { useTranslation } from '../hooks/useTranslation'

interface SessionItemProps {
  session: Session
  isActive: boolean
  mode?: 'active' | 'archived'
  onSelect: (sessionId: string) => void
  onArchive?: () => void
  onRestore?: () => void
  onPin?: () => void
  onRename?: (newTitle: string) => void
  onRegenerateTitle?: () => void
  onDelete?: () => void
  testIdPrefix?: string
  className?: string
}

const SessionItem = memo<SessionItemProps>(
  ({
    session,
    isActive,
    mode = 'active',
    onSelect,
    onArchive,
    onRestore,
    onPin,
    onRename,
    onRegenerateTitle,
    onDelete,
    testIdPrefix = 'sidebar',
    className = '',
  }) => {
    const editableTitleRef = useRef<EditableTextRef>(null)
    const itemRef = useRef<HTMLDivElement>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
    const [isTouch, setIsTouch] = useState(false)
    const { t } = useTranslation()

    // Drag-to-archive gesture
    const isDraggingRef = useRef(false)
    const dragX = useMotionValue(0)
    const archiveOpacity = useTransform(dragX, [-80, -40, 0], [1, 0.5, 0])
    const archiveScale = useTransform(dragX, [-80, -40, 0], [1, 0.8, 0.6])
    const canDragArchive = !!onArchive

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x < -80 && onArchive) {
        onArchive()
      }
      // Defer reset so the click event (which fires synchronously after dragEnd)
      // still sees isDraggingRef=true and skips navigation.
      requestAnimationFrame(() => {
        isDraggingRef.current = false
      })
    }

    // Detect touch device
    useEffect(() => {
      setIsTouch('ontouchend' in document)
    }, [])

    // Only treat empty/whitespace title as generating.
    // Non-empty placeholders should be displayed as-is.
    const isTitleGenerating = !session.title?.trim()

    // Generate title from session (use existing title or show generating state)
    const displayTitle = isTitleGenerating ? t('BiChat.Common.Generating') : (session.title ?? t('BiChat.Common.Untitled'))

    // Long press handlers for touch devices
    const { handlers: longPressHandlers } = useLongPress({
      delay: 500,
      onLongPress: (e) => {
        const target = e.currentTarget as HTMLElement
        setMenuAnchor(target.getBoundingClientRect())
        setMenuOpen(true)
      },
      hapticFeedback: true,
    })

    // Add contextmenu event listener as fallback for iPadOS
    useEffect(() => {
      const element = itemRef.current
      if (!element) return

      const isIPad = /iPad|Macintosh/i.test(navigator.userAgent) && 'ontouchend' in document
      if (!isIPad) return

      const handleContextMenu = (e: Event) => {
        e.preventDefault()
        const target = e.currentTarget as HTMLElement
        setMenuAnchor(target.getBoundingClientRect())
        setMenuOpen(true)
      }

      element.addEventListener('contextmenu', handleContextMenu)
      return () => element.removeEventListener('contextmenu', handleContextMenu)
    }, [itemRef])

    const contextMenuItems: ContextMenuItem[] = mode === 'archived'
      ? [
        ...(onRestore ? [{
          id: 'restore',
          label: t('BiChat.Archived.RestoreButton'),
          icon: <ArrowUUpLeft size={20} />,
          onClick: () => onRestore(),
        }] : []),
        ...(onRename ? [{
          id: 'rename',
          label: t('BiChat.Sidebar.RenameChat'),
          icon: <PencilSimple size={20} />,
          onClick: () => editableTitleRef.current?.startEditing(),
        }] : []),
      ]
      : [
        ...(onPin ? [{
          id: 'pin',
          label: session.pinned ? t('BiChat.Sidebar.UnpinChat') : t('BiChat.Sidebar.PinChat'),
          icon: session.pinned ? <Check size={20} /> : <Bookmark size={20} />,
          onClick: () => onPin(),
        }] : []),
        ...(onRename ? [{
          id: 'rename',
          label: t('BiChat.Sidebar.RenameChat'),
          icon: <PencilSimple size={20} />,
          onClick: () => editableTitleRef.current?.startEditing(),
        }] : []),
        ...(onRegenerateTitle ? [{
          id: 'regenerate',
          label: t('BiChat.Sidebar.RegenerateTitle'),
          icon: <ArrowsClockwise size={20} />,
          onClick: () => onRegenerateTitle(),
        }] : []),
        ...(onArchive ? [{
          id: 'archive',
          label: t('BiChat.Sidebar.ArchiveChat'),
          icon: <Archive size={20} />,
          onClick: () => onArchive(),
          variant: 'danger' as const,
        }] : []),
        ...(onDelete ? [{
          id: 'delete',
          label: t('BiChat.Sidebar.DeleteChat'),
          icon: <Trash size={20} />,
          onClick: () => onDelete(),
          variant: 'danger' as const,
        }] : []),
      ]

    const hasContextMenu = contextMenuItems.length > 0

    return (
      <>
        <motion.div
          variants={sessionItemVariants}
          initial="initial"
          animate="animate"
          whileHover="hover"
          exit="exit"
          className="relative overflow-hidden rounded-lg"
        >
          {/* Archive zone — revealed by drag */}
          {canDragArchive && (
            <motion.div
              className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-gray-500 dark:bg-gray-600 rounded-r-lg"
              style={{ opacity: archiveOpacity, scale: archiveScale }}
              aria-hidden="true"
            >
              <Archive size={20} className="text-white" />
            </motion.div>
          )}

          {/* Draggable item content */}
          <motion.div
            drag={canDragArchive ? 'x' : false}
            dragDirectionLock
            dragConstraints={{ left: -100, right: 0 }}
            dragElastic={{ left: 0.2, right: 0.5 }}
            dragSnapToOrigin
            style={{ x: canDragArchive ? dragX : undefined }}
            onDragStart={() => { isDraggingRef.current = true }}
            onDragEnd={canDragArchive ? handleDragEnd : undefined}
            className="relative"
          >
          <div
            role="button"
            tabIndex={0}
            ref={itemRef}
            onClick={() => {
              if (isDraggingRef.current) return
              onSelect(session.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(session.id)
              }
            }}
            className={`block w-full text-left px-3 py-2 rounded-lg transition-smooth group relative touch-tap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
              isActive
                ? 'bg-primary-50/50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-l-4 border-primary-400 dark:border-primary-600'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border-l-4 border-transparent'
            } ${className}`}
            aria-current={isActive ? 'page' : undefined}
            data-session-item
            data-testid={`${testIdPrefix}-session-${session.id}`}
            {...longPressHandlers}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <EditableText
                  ref={editableTitleRef}
                  value={displayTitle}
                  onSave={(newTitle) => onRename?.(newTitle)}
                  isLoading={isTitleGenerating}
                />
              </div>
              {!isTouch && hasContextMenu && (
                <Menu>
                  <MenuButton
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-smooth flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                    aria-label={t('BiChat.Sidebar.ChatOptions')}
                    data-testid={`${testIdPrefix}-session-options-${session.id}`}
                  >
                    <DotsThree size={16} className="w-4 h-4" weight="bold" />
                  </MenuButton>
                  <MenuItems
                    anchor="bottom start"
                    className="w-52 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-30 [--anchor-gap:8px] mt-1 p-2 space-y-1"
                  >
                    {mode !== 'archived' && onPin && (
                      <MenuItem>
                        {({ focus }) => (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onPin()
                            }}
                            className={`cursor-pointer flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-smooth ${
                              focus
                                ? 'bg-gray-100 dark:bg-gray-800/70 ring-1 ring-gray-200/80 dark:ring-gray-700/80'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            aria-label={session.pinned ? t('BiChat.Sidebar.UnpinChat') : t('BiChat.Sidebar.PinChat')}
                            data-testid={`${testIdPrefix}-session-pin-${session.id}`}
                          >
                            {session.pinned ? (
                              <Check size={16} className="w-4 h-4" />
                            ) : (
                              <Bookmark size={16} className="w-4 h-4" />
                            )}
                            {session.pinned ? t('BiChat.Sidebar.UnpinChat') : t('BiChat.Sidebar.PinChat')}
                          </button>
                        )}
                      </MenuItem>
                    )}
                    {onRename && (
                      <MenuItem>
                        {({ focus, close }) => (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              editableTitleRef.current?.startEditing()
                              close()
                            }}
                            className={`cursor-pointer flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-smooth ${
                              focus
                                ? 'bg-gray-100 dark:bg-gray-800/70 ring-1 ring-gray-200/80 dark:ring-gray-700/80'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            aria-label={t('BiChat.Sidebar.RenameChat')}
                            data-testid={`${testIdPrefix}-session-rename-${session.id}`}
                          >
                            <PencilSimple size={16} className="w-4 h-4" />
                            {t('BiChat.Sidebar.RenameChat')}
                          </button>
                        )}
                      </MenuItem>
                    )}
                    {mode !== 'archived' && onRegenerateTitle && (
                      <MenuItem>
                        {({ focus, close }) => (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onRegenerateTitle()
                              close()
                            }}
                            className={`cursor-pointer flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-smooth ${
                              focus
                                ? 'bg-gray-100 dark:bg-gray-800/70 ring-1 ring-gray-200/80 dark:ring-gray-700/80'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            aria-label={t('BiChat.Sidebar.RegenerateTitle')}
                            data-testid={`${testIdPrefix}-session-regenerate-${session.id}`}
                          >
                            <ArrowsClockwise size={16} className="w-4 h-4" />
                            {t('BiChat.Sidebar.RegenerateTitle')}
                          </button>
                        )}
                      </MenuItem>
                    )}
                    {mode === 'archived' && onRestore && (
                      <MenuItem>
                        {({ focus }) => (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onRestore()
                            }}
                            className={`cursor-pointer flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-smooth ${
                              focus
                                ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200/70 dark:ring-green-500/30'
                                : 'text-green-700 dark:text-green-300 hover:bg-green-50/70 dark:hover:bg-green-900/10'
                            }`}
                            aria-label={t('BiChat.Archived.RestoreButton')}
                            data-testid={`${testIdPrefix}-session-restore-${session.id}`}
                          >
                            <ArrowUUpLeft size={16} className="w-4 h-4" />
                            {t('BiChat.Archived.RestoreButton')}
                          </button>
                        )}
                      </MenuItem>
                    )}
                    {mode !== 'archived' && onArchive && (
                      <MenuItem>
                        {({ focus }) => (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onArchive()
                            }}
                            className={`cursor-pointer flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-smooth ${
                              focus
                                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200/70 dark:ring-amber-500/30'
                                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50/70 dark:hover:bg-amber-900/10'
                            }`}
                            aria-label={t('BiChat.Sidebar.ArchiveChat')}
                            data-testid={`${testIdPrefix}-session-archive-${session.id}`}
                          >
                            <Archive size={16} className="w-4 h-4" />
                            {t('BiChat.Sidebar.ArchiveChat')}
                          </button>
                        )}
                      </MenuItem>
                    )}
                    {onDelete && (
                      <MenuItem>
                        {({ focus }) => (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onDelete()
                            }}
                            className={`cursor-pointer flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-smooth ${
                              focus
                                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200/70 dark:ring-red-500/30'
                                : 'text-red-600 dark:text-red-400 hover:bg-red-50/70 dark:hover:bg-red-900/10'
                            }`}
                            aria-label={t('BiChat.Sidebar.DeleteChat')}
                            data-testid={`${testIdPrefix}-session-delete-${session.id}`}
                          >
                            <Trash size={16} className="w-4 h-4" />
                            {t('BiChat.Sidebar.DeleteChat')}
                          </button>
                        )}
                      </MenuItem>
                    )}
                  </MenuItems>
                </Menu>
              )}
            </div>
          </div>
          </motion.div>
        </motion.div>
        <TouchContextMenu
          items={contextMenuItems}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchorRect={menuAnchor}
        />
      </>
    )
  }
)

SessionItem.displayName = 'SessionItem'

export default SessionItem
