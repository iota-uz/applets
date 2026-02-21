/**
 * ChartCard Component
 * Renders chart visualizations using ApexCharts
 *
 * Supports multiple chart types: line, bar, pie, area, donut
 * Includes PNG export functionality and responsive styling
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import ReactApexChart from 'react-apexcharts'
import ApexCharts, { ApexOptions } from 'apexcharts'
import { DownloadSimple } from '@phosphor-icons/react'
import type { ChartData } from '../types'
import { useTranslation } from '../hooks/useTranslation'

interface ChartCardProps {
  chartData: ChartData
  onExportError?: (error: string) => void
}

interface InlineTooltipState {
  left: number
  top: number
  label: string
  seriesName: string
  value: string
}

interface HoverEventLike {
  target?: EventTarget | null
  clientX?: number
  clientY?: number
}

// Default color palette if none provided
const DEFAULT_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6']
const TOOLTIP_X_PADDING = 12
const TOOLTIP_Y_PADDING = 8
const TOOLTIP_CURSOR_Y_OFFSET = 12

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getEventClientValue(event: unknown, key: 'clientX' | 'clientY'): number | null {
  if (!event || typeof event !== 'object') {
    return null
  }

  const value = (event as HoverEventLike)[key]
  return typeof value === 'number' ? value : null
}

/**
 * ChartCard renders a single chart visualization with optional PNG export.
 */
export function ChartCard({ chartData, onExportError }: ChartCardProps) {
  const { t } = useTranslation()
  const chartId = useId().replace(/:/g, '_')
  const [isExporting, setIsExporting] = useState(false)
  const [useInlineTooltip, setUseInlineTooltip] = useState(false)
  const [inlineTooltip, setInlineTooltip] = useState<InlineTooltipState | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const { chartType, title, series, labels, colors, height = 350 } = chartData
  const chartLabels = useMemo(
    () => (labels ?? []).filter((label): label is string => label !== null),
    [labels]
  )

  const hasValidData =
    series && series.length > 0 && series.some((s) => s.data && s.data.length > 0)

  useEffect(() => {
    const rootNode = cardRef.current?.getRootNode()
    const inShadowRoot =
      typeof ShadowRoot !== 'undefined' && rootNode instanceof ShadowRoot
    setUseInlineTooltip(chartType === 'bar' && inShadowRoot)
  }, [chartType])

  useEffect(() => {
    if (!useInlineTooltip) {
      setInlineTooltip(null)
    }
  }, [useInlineTooltip])

  if (!hasValidData) {
    return (
      <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {title && <span className="font-medium">{title}: </span>}
          {t('BiChat.Chart.NoData')}
        </p>
      </div>
    )
  }

  const apexSeries = useMemo(
    () =>
      chartType === 'pie' || chartType === 'donut'
        ? series[0]?.data ?? []
        : series.map((s) => ({ name: s.name, data: s.data })),
    [chartType, series],
  )

  const xaxisConfig = useMemo(
    () =>
      chartType !== 'pie' && chartType !== 'donut'
        ? { categories: chartLabels }
        : {},
    [chartType, chartLabels],
  )

  const labelsConfig = useMemo(
    () =>
      chartType === 'pie' || chartType === 'donut'
        ? chartLabels
        : [],
    [chartType, chartLabels],
  )

  const handleDataPointMouseEnter = useCallback(
    (event: unknown, _chartContext: unknown, config: { seriesIndex?: number; dataPointIndex?: number }) => {
      if (!useInlineTooltip || chartType !== 'bar' || !cardRef.current) {
        return
      }

      const target =
        (event &&
          typeof event === 'object' &&
          'target' in event &&
          (event as { target?: Element | null }).target?.closest('.apexcharts-bar-area')) ||
        null

      if (!(target instanceof SVGGraphicsElement)) {
        return
      }

      const seriesIndex = typeof config?.seriesIndex === 'number' ? config.seriesIndex : 0
      const dataPointIndex = typeof config?.dataPointIndex === 'number' ? config.dataPointIndex : -1
      if (dataPointIndex < 0) {
        return
      }

      const cardRect = cardRef.current.getBoundingClientRect()
      const barRect = target.getBoundingClientRect()
      const rawValue = series?.[seriesIndex]?.data?.[dataPointIndex] ?? target.getAttribute('val') ?? ''
      const value =
        typeof rawValue === 'number' && Number.isFinite(rawValue)
          ? rawValue.toLocaleString()
          : String(rawValue)
      const label = chartLabels[dataPointIndex] || ''
      const seriesName = series?.[seriesIndex]?.name || 'Value'

      const cursorX = getEventClientValue(event, 'clientX')
      const cursorY = getEventClientValue(event, 'clientY')
      const fallbackLeft = barRect.left - cardRect.left + barRect.width / 2
      const fallbackTop = barRect.top - cardRect.top - TOOLTIP_Y_PADDING
      const maxLeft = Math.max(cardRect.width - TOOLTIP_X_PADDING, TOOLTIP_X_PADDING)
      const maxTop = Math.max(cardRect.height - TOOLTIP_Y_PADDING, TOOLTIP_Y_PADDING)

      const left = clamp(
        cursorX !== null ? cursorX - cardRect.left : fallbackLeft,
        TOOLTIP_X_PADDING,
        maxLeft
      )
      const top = clamp(
        cursorY !== null ? cursorY - cardRect.top - TOOLTIP_CURSOR_Y_OFFSET : fallbackTop,
        TOOLTIP_Y_PADDING,
        maxTop
      )

      setInlineTooltip({ left, top, label, seriesName, value })
    },
    [chartLabels, chartType, series, useInlineTooltip]
  )

  const handleMouseLeave = useCallback(() => {
    setInlineTooltip(null)
  }, [])

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        id: chartId,
        type: chartType as 'line' | 'bar' | 'area' | 'pie' | 'donut',
        toolbar: { show: false },
        animations: { enabled: false },
        fontFamily: 'inherit',
        ...(useInlineTooltip
          ? {
              events: {
                dataPointMouseEnter: handleDataPointMouseEnter,
                mouseLeave: handleMouseLeave,
              },
            }
          : {}),
      },
      tooltip: {
        enabled: !useInlineTooltip,
        followCursor: true,
      },
      title: {
        text: title,
        align: 'left',
        style: { fontSize: '14px', fontWeight: 600 },
      },
      colors: colors?.length ? colors : DEFAULT_COLORS,
      xaxis: xaxisConfig,
      labels: labelsConfig,
      plotOptions: {
        bar: { columnWidth: '60%' },
      },
      legend: { position: 'bottom', horizontalAlign: 'center' },
      dataLabels: { enabled: chartType === 'pie' || chartType === 'donut' },
      stroke: {
        curve: 'smooth',
        width: chartType === 'line' || chartType === 'area' ? 2 : 0,
      },
      fill: { opacity: chartType === 'area' ? 0.4 : 1 },
      grid: {
        borderColor: 'var(--bichat-color-chart-grid, rgba(148, 163, 184, 0.15))',
        strokeDashArray: 3,
      },
    }),
    [chartId, chartType, title, colors, xaxisConfig, labelsConfig, useInlineTooltip, handleDataPointMouseEnter, handleMouseLeave],
  )

  const handleExportPNG = async () => {
    setIsExporting(true)

    try {
      const chart = ApexCharts.getChartByID(chartId)
      if (!chart) {
        const msg = 'Chart instance not available'
        console.error(msg)
        onExportError?.(msg)
        return
      }
      const result = await chart.dataURI({ scale: 2 })

      if (!('imgURI' in result)) {
        const msg = 'Unexpected dataURI result format'
        console.error(msg)
        onExportError?.(msg)
        return
      }

      const link = document.createElement('a')
      link.href = result.imgURI
      link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_chart.png`
      link.click()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to export chart'
      console.error('Failed to export chart:', error)
      onExportError?.(msg)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div
      ref={cardRef}
      className="group/chart relative rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow dark:border-gray-700/60 dark:bg-gray-800"
      onMouseLeave={handleMouseLeave}
    >
      <ReactApexChart
        options={options}
        series={apexSeries}
        type={chartType}
        width="100%"
        height={height}
      />
      {useInlineTooltip && inlineTooltip && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: `${inlineTooltip.left}px`,
            top: `${inlineTooltip.top}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="min-w-[140px] overflow-hidden rounded-md border border-gray-200 bg-white text-xs text-gray-700 shadow-md dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
            {inlineTooltip.label && (
              <div className="border-b border-gray-200 px-2.5 py-1.5 font-medium dark:border-gray-600">
                {inlineTooltip.label}
              </div>
            )}
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="h-2 w-2 rounded-full bg-primary-600" />
              <span>
                {inlineTooltip.seriesName}: <strong>{inlineTooltip.value}</strong>
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleExportPNG}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-400 opacity-0 transition-all duration-150 hover:bg-gray-100 hover:text-gray-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 group-hover/chart:opacity-100 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          title={t('BiChat.Chart.Download')}
        >
          {isExporting ? (
            <span className="text-gray-500 dark:text-gray-400">{t('BiChat.Chart.Exporting')}</span>
          ) : (
            <>
              <DownloadSimple className="h-3.5 w-3.5" weight="bold" />
              <span>{t('BiChat.Chart.DownloadPNG')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
