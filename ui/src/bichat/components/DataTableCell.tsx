import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Check } from '@phosphor-icons/react'
import type { FormattedCell } from '../utils/columnTypes'
import { useTranslation } from '../hooks/useTranslation'

interface DataTableCellProps {
  formatted: FormattedCell
  alignment: 'left' | 'right'
  onCopy?: (value: string) => void
  isSticky?: boolean
  stickyClassName?: string
}

type CellRenderer = (props: {
  formatted: FormattedCell
  tooltipRef: React.Ref<HTMLSpanElement>
  onMouseEnter: () => void
  onMouseLeave: () => void
}) => ReactNode

const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:']

function safeHref(input: string): string {
  if (!input || typeof input !== 'string') return '#'
  try {
    const url = new URL(input, 'https://example.com')
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? url.href : '#'
  } catch {
    return '#'
  }
}

const cellRenderers: Record<string, CellRenderer> = {
  boolean: ({ formatted }) => (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        formatted.raw === true
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
      }`}
    >
      {formatted.display}
    </span>
  ),
  url: ({ formatted, tooltipRef, onMouseEnter, onMouseLeave }) => {
    const href = safeHref(formatted.display)
    if (href === '#') {
      return (
        <span
          ref={tooltipRef}
          className="block max-w-[420px] truncate text-gray-700 dark:text-gray-300"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {formatted.display}
        </span>
      )
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          ref={tooltipRef}
          className="block max-w-[420px] truncate"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {formatted.display}
        </span>
      </a>
    )
  },
  number: ({ formatted, tooltipRef, onMouseEnter, onMouseLeave }) => (
    <span
      ref={tooltipRef}
      className="block font-mono text-gray-700 dark:text-gray-300 tabular-nums"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {formatted.display}
    </span>
  ),
  date: ({ formatted, tooltipRef, onMouseEnter, onMouseLeave }) => (
    <span
      ref={tooltipRef}
      className="block text-gray-700 dark:text-gray-300"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {formatted.display}
    </span>
  ),
}

const defaultRenderer: CellRenderer = ({ formatted, tooltipRef, onMouseEnter, onMouseLeave }) => (
  <span
    ref={tooltipRef}
    className="block max-w-[420px] truncate text-gray-700 dark:text-gray-300"
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    {formatted.display}
  </span>
)

export const DataTableCell = memo(function DataTableCell({
  formatted,
  alignment,
  onCopy,
  isSticky,
  stickyClassName,
}: DataTableCellProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const tdRef = useRef<HTMLTableCellElement>(null)

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onCopy) return
    const text = formatted.isNull ? '' : String(formatted.raw ?? formatted.display)
    onCopy(text)
    clearTimeout(copyTimerRef.current)
    setCopied(true)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [onCopy, formatted])

  const [hovered, setHovered] = useState(false)

  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleMouseEnter = useCallback(() => {
    const el = tooltipRef.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    tooltipTimerRef.current = setTimeout(() => {
      const rect = el.getBoundingClientRect()
      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 4,
      })
    }, 300)
  }, [])

  const handleMouseLeave = useCallback(() => {
    clearTimeout(tooltipTimerRef.current)
    setTooltip(null)
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(tooltipTimerRef.current)
      clearTimeout(copyTimerRef.current)
    }
  }, [])

  const hasOverflow = formatted.type === 'string' || formatted.type === 'url' || formatted.type === 'date' || formatted.type === 'number'
  const tooltipContent = formatted.isNull ? null : (formatted.type === 'number' || formatted.type === 'date') ? String(formatted.raw) : formatted.display

  const rendererProps = { formatted, tooltipRef, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave }

  const showCopyButton = onCopy && (hovered || copied) && !formatted.isNull

  return (
    <td
      ref={tdRef}
      className={`relative px-3 py-2 align-top ${alignment === 'right' ? 'text-right' : 'text-left'} ${isSticky ? stickyClassName ?? '' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {formatted.isNull ? (
        <span className="text-xs text-gray-400 dark:text-gray-500">&mdash;</span>
      ) : (
        (cellRenderers[formatted.type] ?? defaultRenderer)(rendererProps)
      )}
      {showCopyButton && (
        <button
          type="button"
          onClick={handleCopy}
          className={`absolute top-1 right-1 cursor-pointer rounded p-0.5 transition-colors ${
            copied
              ? 'text-green-600 dark:text-green-400'
              : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
          }`}
          aria-label={copied ? t('BiChat.Message.Copied') : t('BiChat.DataTable.Copy')}
        >
          {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
        </button>
      )}
      {tooltip && hasOverflow && tooltipContent && createPortal(
        <div
          className="pointer-events-none fixed max-w-[400px] rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg break-words dark:bg-gray-700"
          style={{
            zIndex: 100001,
            left: Math.min(tooltip.x, window.innerWidth - 420),
            top: tooltip.y,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltipContent}
        </div>,
        document.body,
      )}
    </td>
  )
})
