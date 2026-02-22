/**
 * TabbedChartGroup — wraps multiple ChartCards behind a tab bar.
 *
 * When an assistant turn produces 2+ charts, this component replaces the
 * default vertical stack with a compact tabbed card that occupies 1x space.
 *
 * Charts are rendered once and never remount — the wrapper toggles between
 * inline and fullscreen CSS so ApexCharts state is preserved across all
 * transitions.
 */

import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import { X } from '@phosphor-icons/react'
import type { ChartData } from '../types'
import type { ChartCardHost } from './ChartCard'
import { useTranslation } from '../hooks/useTranslation'
import { TabBar } from './TabBar'
import { ChartCard } from './ChartCard'

export interface TabbedChartGroupProps {
  charts: ChartData[]
}

const INLINE_CLASS = 'w-full min-w-0 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40 overflow-hidden'
const FULLSCREEN_CLASS = 'fixed inset-4 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900'

export const TabbedChartGroup = memo(function TabbedChartGroup({
  charts,
}: TabbedChartGroupProps) {
  const { t } = useTranslation()
  const [activeTabId, setActiveTabId] = useState('chart-0')
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
      charts.map((chart, i) => ({
        id: `chart-${i}`,
        label: chart.title || `${t('BiChat.Chart.Title')} ${i + 1}`,
      })),
    [charts, t],
  )

  const host = useMemo<ChartCardHost>(
    () => ({ isFullscreen }),
    [isFullscreen],
  )

  // Guard against stale activeTabId
  const resolvedActiveId = tabs.some((tab) => tab.id === activeTabId)
    ? activeTabId
    : tabs[0]?.id ?? ''

  if (charts.length === 0) return null

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

        {charts.map((chart, i) => {
          const tabId = `chart-${i}`
          const isActive = tabId === resolvedActiveId
          return (
          <div
            key={tabId}
            id={`${tabId}-panel`}
            role="tabpanel"
            aria-labelledby={tabId}
            hidden={!isActive}
            className={isActive && isFullscreen ? 'flex-1 flex flex-col min-h-0' : isActive ? undefined : 'hidden'}
          >
            <ChartCard
              chartData={chart}
              host={host}
            />
          </div>
          )
        })}
      </section>
    </>
  )
})
