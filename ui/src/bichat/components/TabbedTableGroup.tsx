/**
 * TabbedTableGroup — wraps multiple InteractiveTableCards behind a tab bar.
 *
 * When an assistant turn produces 2+ tables, this component replaces the
 * default vertical stack with a compact tabbed card that occupies 1x space.
 *
 * Tables are rendered once and never remount — the wrapper toggles between
 * inline and fullscreen CSS so useDataTable state (search, sort, page) is
 * preserved across all transitions.
 */

import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import { X } from '@phosphor-icons/react'
import type { RenderTableData } from '../types'
import type { TableCardHost } from './InteractiveTableCard'
import { useTranslation } from '../hooks/useTranslation'
import { TabBar } from './TabBar'
import { InteractiveTableCard } from './InteractiveTableCard'

export interface TabbedTableGroupProps {
  tables: RenderTableData[]
  onSendMessage?: (content: string) => void
  sendDisabled?: boolean
}

const INLINE_CLASS = 'w-full min-w-0 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40 overflow-hidden'
const FULLSCREEN_CLASS = 'fixed inset-4 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900'

export const TabbedTableGroup = memo(function TabbedTableGroup({
  tables,
  onSendMessage,
  sendDisabled = false,
}: TabbedTableGroupProps) {
  const { t } = useTranslation()
  const [activeTabId, setActiveTabId] = useState(tables[0]?.id ?? '')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLElement>(null)

  const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), [])

  // Escape key + focus management for fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    containerRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setIsFullscreen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])

  const tabs = useMemo(
    () =>
      tables.map((table, i) => ({
        id: table.id,
        label: `${table.title || `${t('BiChat.Table.QueryResults')} ${i + 1}`} (${table.rows.length})`,
      })),
    [tables, t],
  )

  const host = useMemo<TableCardHost>(
    () => ({ onToggleFullscreen: toggleFullscreen, isFullscreen }),
    [toggleFullscreen, isFullscreen],
  )

  // Guard against empty or stale activeTabId
  const resolvedActiveId = tabs.some((tab) => tab.id === activeTabId)
    ? activeTabId
    : tabs[0]?.id ?? ''

  if (tables.length === 0) return null

  return (
    <>
      {/* Backdrop — only when fullscreen */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          style={{ zIndex: 99998 }}
          onClick={toggleFullscreen}
          aria-hidden
        />
      )}

      <section
        ref={containerRef}
        tabIndex={isFullscreen ? -1 : undefined}
        className={isFullscreen ? FULLSCREEN_CLASS : INLINE_CLASS}
        style={isFullscreen ? { zIndex: 99999 } : undefined}
      >
        {/* Close button — fullscreen only */}
        {isFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute right-3 top-3 z-10 cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label={t('BiChat.DataTable.Collapse')}
          >
            <X size={18} weight="bold" />
          </button>
        )}

        <TabBar
          tabs={tabs}
          activeTab={resolvedActiveId}
          onTabChange={setActiveTabId}
          compact={isFullscreen}
        />

        {tables.map((table) => {
          const isActive = table.id === resolvedActiveId
          return (
          <div
            key={table.id}
            id={`${table.id}-panel`}
            role="tabpanel"
            aria-labelledby={table.id}
            hidden={!isActive}
            className={isActive && isFullscreen ? 'flex-1 flex flex-col min-h-0' : isActive ? undefined : 'hidden'}
          >
            <InteractiveTableCard
              table={table}
              onSendMessage={onSendMessage}
              sendDisabled={sendDisabled}
              host={host}
            />
          </div>
          )
        })}
      </section>
    </>
  )
})
