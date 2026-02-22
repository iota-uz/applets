/**
 * TabbedTableGroup — wraps multiple InteractiveTableCards behind a tab bar.
 *
 * When an assistant turn produces 2+ tables, this component replaces the
 * default vertical stack with a compact tabbed card that occupies 1x space.
 * All tables stay mounted (hidden) so useDataTable state is preserved.
 */

import { useState, useMemo, useCallback, memo } from 'react'
import type { RenderTableData } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import { TabBar } from './TabBar'
import { InteractiveTableCard } from './InteractiveTableCard'
import { FullscreenOverlay } from './FullscreenOverlay'

export interface TabbedTableGroupProps {
  tables: RenderTableData[]
  onSendMessage?: (content: string) => void
  sendDisabled?: boolean
}

export const TabbedTableGroup = memo(function TabbedTableGroup({
  tables,
  onSendMessage,
  sendDisabled = false,
}: TabbedTableGroupProps) {
  const { t } = useTranslation()
  const [activeTabId, setActiveTabId] = useState(tables[0]?.id ?? '')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), [])

  const tabs = useMemo(
    () =>
      tables.map((table, i) => ({
        id: table.id,
        label: `${table.title || `${t('BiChat.Table.QueryResults')} ${i + 1}`} (${table.rows.length})`,
      })),
    [tables, t],
  )

  // Guard against empty or stale activeTabId (e.g. tables array changed)
  const resolvedActiveId = tabs.some((tab) => tab.id === activeTabId)
    ? activeTabId
    : tabs[0]?.id ?? ''

  if (tables.length === 0) return null

  const activeTitle = tables.find((t) => t.id === resolvedActiveId)?.title || t('BiChat.Table.QueryResults')

  const renderPanels = (fillHeight: boolean) =>
    tables.map((table) => (
      <div
        key={table.id}
        id={`${table.id}-panel`}
        role="tabpanel"
        aria-labelledby={table.id}
        hidden={table.id !== resolvedActiveId}
        className={fillHeight ? 'flex-1 flex flex-col min-h-0' : undefined}
      >
        <InteractiveTableCard
          table={table}
          onSendMessage={onSendMessage}
          sendDisabled={sendDisabled}
          embedded
          fillHeight={fillHeight}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    ))

  return (
    <>
      <section className="w-full min-w-0 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40 overflow-hidden">
        <TabBar tabs={tabs} activeTab={resolvedActiveId} onTabChange={setActiveTabId} />
        {renderPanels(false)}
      </section>

      {isFullscreen && (
        <FullscreenOverlay
          title={activeTitle}
          onClose={toggleFullscreen}
          closeLabel={t('BiChat.DataTable.Collapse')}
        >
          <TabBar tabs={tabs} activeTab={resolvedActiveId} onTabChange={setActiveTabId} />
          {renderPanels(true)}
        </FullscreenOverlay>
      )}
    </>
  )
})
