import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { RenderTableData } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import { TableExportButton } from './TableExportButton'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200]

interface InteractiveTableCardProps {
  table: RenderTableData
  onSendMessage?: (content: string) => void
  sendDisabled?: boolean
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export const InteractiveTableCard = memo(function InteractiveTableCard({
  table,
  onSendMessage,
  sendDisabled = false,
}: InteractiveTableCardProps) {
  const { t } = useTranslation()
  const defaultPageSize = Math.min(Math.max(table.pageSize || 25, 1), 200)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  useEffect(() => {
    const nextPageSize = Math.min(Math.max(table.pageSize || 25, 1), 200)
    setPage(1)
    setPageSize(nextPageSize)
  }, [table.id, table.pageSize])

  const totalRows = table.rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return table.rows.slice(start, start + pageSize)
  }, [page, pageSize, table.rows])

  const pageSizeOptions = useMemo(() => {
    const set = new Set<number>([...PAGE_SIZE_OPTIONS, defaultPageSize])
    return [...set].sort((a, b) => a - b)
  }, [defaultPageSize])

  const canExportViaPrompt = !!onSendMessage && !!table.exportPrompt
  const exportDisabled = sendDisabled || (!table.export?.url && !canExportViaPrompt)

  const handleExport = useCallback(() => {
    if (table.export?.url) {
      try {
        const parsed = new URL(table.export.url, window.location.origin)
        if (!['http:', 'https:', 'blob:'].includes(parsed.protocol)) {
          console.warn('[InteractiveTableCard] Blocked export URL with unsafe protocol:', parsed.protocol)
          return
        }
      } catch {
        console.warn('[InteractiveTableCard] Blocked malformed export URL')
        return
      }
      const link = document.createElement('a')
      link.href = table.export.url
      link.download = table.export.filename || 'table_export.xlsx'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return
    }

    if (canExportViaPrompt && table.exportPrompt) {
      onSendMessage?.(table.exportPrompt)
    }
  }, [canExportViaPrompt, onSendMessage, table.export, table.exportPrompt])

  const from = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalRows)

  return (
    <section className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {table.title || t('BiChat.Table.QueryResults')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {totalRows === 1
              ? t('BiChat.Table.OneRowLoaded')
              : t('BiChat.Table.RowsLoaded', { count: String(totalRows) })}
            {table.truncated ? ` ${t('BiChat.Table.TruncatedSuffix')}` : ''}
          </p>
        </div>

        <TableExportButton
          onClick={handleExport}
          disabled={exportDisabled}
          label={t('BiChat.Table.ExportToExcel')}
          disabledTooltip={sendDisabled ? t('BiChat.Table.PleaseWait') : t('BiChat.Table.ExportUnavailable')}
        />
      </header>

      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {table.headers.map((header, index) => (
                <th
                  key={`${table.id}-header-${index}`}
                  className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => (
              <tr
                key={`${table.id}-row-${rowIndex}`}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                {table.columns.map((_, columnIndex) => (
                  <td
                    key={`${table.id}-cell-${rowIndex}-${columnIndex}`}
                    className="px-3 py-2 text-gray-700 dark:text-gray-300 align-top"
                  >
                    <span className="block max-w-[420px] truncate" title={formatCell(row[columnIndex])}>
                      {formatCell(row[columnIndex])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={table.columns.length}
                  className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {t('BiChat.Table.NoRows')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 dark:border-gray-700 px-3 py-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t('BiChat.Table.Showing', {
            from: String(from),
            to: String(to),
            total: String(totalRows),
          })}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor={`${table.id}-page-size`}>
            {t('BiChat.Table.RowsLabel')}
          </label>
          <select
            id={`${table.id}-page-size`}
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(1)
            }}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
          >
            {pageSizeOptions.map((option) => (
              <option key={`${table.id}-size-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="cursor-pointer rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('BiChat.Table.Prev')}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('BiChat.Table.PageOf', { page: String(page), total: String(totalPages) })}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="cursor-pointer rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('BiChat.Table.Next')}
          </button>
        </div>
      </footer>

      {table.truncated && (
        <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
          {t('BiChat.Table.TruncatedNotice')}
        </p>
      )}
    </section>
  )
})
