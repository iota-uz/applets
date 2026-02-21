import { memo, useCallback } from 'react'
import type { RenderTableData } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import { useDataTable, type DataTableOptions } from '../hooks/useDataTable'
import { TableExportButton } from './TableExportButton'
import { DataTableHeader } from './DataTableHeader'
import { DataTableCell } from './DataTableCell'
import { DataTableToolbar } from './DataTableToolbar'
import { DataTableStatsBar } from './DataTableStatsBar'

interface InteractiveTableCardProps {
  table: RenderTableData
  onSendMessage?: (content: string) => void
  sendDisabled?: boolean
  options?: DataTableOptions
}

export const InteractiveTableCard = memo(function InteractiveTableCard({
  table,
  onSendMessage,
  sendDisabled = false,
  options,
}: InteractiveTableCardProps) {
  const { t } = useTranslation()

  const dt = useDataTable(table, options)

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

  const handleCellCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }, [])

  const hasHiddenColumns = dt.columns.some((c) => !c.visible)
  const from = dt.totalFilteredRows === 0 ? 0 : (dt.page - 1) * dt.pageSize + 1
  const to = Math.min(dt.page * dt.pageSize, dt.totalFilteredRows)

  return (
    <section className="w-full rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40">
      {/* Toolbar: search, columns, stats, visualize */}
      <DataTableToolbar
        columns={dt.columns}
        searchQuery={dt.searchQuery}
        onSearchChange={dt.setSearchQuery}
        showStats={dt.showStats}
        onToggleStats={dt.setShowStats}
        onToggleColumnVisibility={dt.toggleColumnVisibility}
        onResetColumnVisibility={dt.resetColumnVisibility}
        onSendMessage={onSendMessage}
        sendDisabled={sendDisabled}
        hasHiddenColumns={hasHiddenColumns}
      />

      {/* Title + export */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {table.title || t('BiChat.Table.QueryResults')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {dt.totalFilteredRows === table.rows.length
              ? dt.totalFilteredRows === 1
                ? t('BiChat.Table.OneRowLoaded')
                : t('BiChat.Table.RowsLoaded', { count: String(dt.totalFilteredRows) })
              : t('BiChat.DataTable.FilteredRows', {
                  filtered: String(dt.totalFilteredRows),
                  total: String(table.rows.length),
                })}
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

      {/* Table */}
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <DataTableHeader
            tableId={table.id}
            columns={dt.visibleColumns}
            sort={dt.sort}
            onToggleSort={dt.toggleSort}
            onColumnResize={dt.setColumnWidth}
            onToggleVisibility={dt.toggleColumnVisibility}
            onSendMessage={onSendMessage}
            sendDisabled={sendDisabled}
          />
          <tbody>
            {dt.pageRows.map((row, rowIndex) => (
              <tr
                key={`${table.id}-row-${rowIndex}`}
                className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
              >
                {dt.visibleColumns.map((col) => (
                  <DataTableCell
                    key={`${table.id}-cell-${rowIndex}-${col.index}`}
                    tableId={table.id}
                    rowIndex={rowIndex}
                    columnIndex={col.index}
                    formatted={dt.formatCell(row[col.index], col.index)}
                    alignment={dt.getCellAlignment(col.index)}
                    onCopy={handleCellCopy}
                  />
                ))}
              </tr>
            ))}
            {dt.pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={dt.visibleColumns.length}
                  className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {dt.searchQuery
                    ? t('BiChat.DataTable.NoSearchResults')
                    : t('BiChat.Table.NoRows')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Stats bar */}
      {dt.showStats && (
        <DataTableStatsBar
          columns={dt.visibleColumns}
          stats={dt.columnStats}
        />
      )}

      {/* Pagination */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t('BiChat.Table.Showing', {
            from: String(from),
            to: String(to),
            total: String(dt.totalFilteredRows),
          })}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor={`${table.id}-page-size`}>
            {t('BiChat.Table.RowsLabel')}
          </label>
          <select
            id={`${table.id}-page-size`}
            value={dt.pageSize}
            onChange={(event) => dt.setPageSize(Number(event.target.value))}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            {dt.pageSizeOptions.map((option) => (
              <option key={`${table.id}-size-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => dt.setPage(Math.max(1, dt.page - 1))}
            disabled={dt.page <= 1}
            className="cursor-pointer rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
          >
            {t('BiChat.Table.Prev')}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('BiChat.Table.PageOf', { page: String(dt.page), total: String(dt.totalPages) })}
          </span>
          <button
            type="button"
            onClick={() => dt.setPage(Math.min(dt.totalPages, dt.page + 1))}
            disabled={dt.page >= dt.totalPages}
            className="cursor-pointer rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
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
