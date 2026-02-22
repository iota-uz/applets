import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import type { RenderTableData } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import { useToast } from '../hooks/useToast'
import { useDataTable, type DataTableOptions } from '../hooks/useDataTable'
import { TableExportButton } from './TableExportButton'
import { DataTableHeader } from './DataTableHeader'
import { DataTableCell } from './DataTableCell'
import { DataTableToolbar } from './DataTableToolbar'
import { DataTableFooter } from './DataTableFooter'

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) pages.push('ellipsis')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}

function PaginationButton({
  onClick,
  disabled,
  active,
  children,
  ...rest
}: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
  'aria-label'?: string
  'aria-current'?: 'page'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[1.5rem] cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
      } disabled:cursor-not-allowed disabled:opacity-40`}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * Shadow-DOM-safe fullscreen overlay. Headless UI Dialog portals to document.body
 * which escapes the shadow DOM boundary and loses Tailwind styles.
 * This component stays inline within the shadow tree.
 */
function FullscreenOverlay({
  title,
  onClose,
  closeLabel,
  children,
}: {
  title: string
  onClose: () => void
  closeLabel: string
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0" style={{ zIndex: 99999 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute inset-4 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl outline-none dark:border-gray-700 dark:bg-gray-900"
      >
        <span className="sr-only">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          aria-label={closeLabel}
        >
          <X size={18} weight="bold" />
        </button>
        {children}
      </div>
    </div>
  )
}

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
  const toast = useToast()

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

  const handleCellCopy = useCallback(
    (text: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => toast.success(t('BiChat.Message.CopiedToClipboard')))
        .catch(() => toast.error(t('BiChat.Message.FailedToCopy')))
    },
    [toast, t],
  )

  const handleCopyTable = useCallback(() => {
    const tsv = dt.getTableAsTSV()
    navigator.clipboard
      .writeText(tsv)
      .then(() => toast.success(t('BiChat.DataTable.TableCopied')))
      .catch(() => toast.error(t('BiChat.Message.FailedToCopy')))
  }, [dt, toast, t])

  const [isFullscreen, setIsFullscreen] = useState(false)

  const hasHiddenColumns = dt.columns.some((c) => !c.visible)
  const from = dt.totalFilteredRows === 0 ? 0 : (dt.page - 1) * dt.pageSize + 1
  const to = Math.min(dt.page * dt.pageSize, dt.totalFilteredRows)

  const renderToolbar = (fullscreen: boolean) => (
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
      sort={dt.sort}
      onClearSort={dt.clearSort}
      onCopyTable={handleCopyTable}
      isFullscreen={fullscreen}
      onToggleFullscreen={() => setIsFullscreen((v) => !v)}
    />
  )

  const renderHeader = () => (
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
  )

  const renderTable = (scrollClass: string) => (
    <div className={scrollClass}>
      <table className="min-w-full border-collapse text-sm">
        <DataTableHeader
          tableId={table.id}
          columns={dt.visibleColumns}
          sort={dt.sort}
          onToggleSort={dt.toggleSort}
          onColumnResize={dt.setColumnWidth}
          onToggleVisibility={dt.toggleColumnVisibility}
          onSendMessage={onSendMessage}
          sendDisabled={sendDisabled}
          showRowNumbers
        />
        <tbody>
          {dt.pageRows.map((row, rowIndex) => (
            <tr
              key={`${table.id}-row-${rowIndex}`}
              className={`border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40 ${
                rowIndex % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''
              }`}
            >
              <td className={`sticky left-0 z-[2] w-10 px-2 py-2 text-right text-xs tabular-nums text-gray-400 dark:text-gray-500 select-none ${rowIndex % 2 === 1 ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-900'}`}>
                {(dt.page - 1) * dt.pageSize + rowIndex + 1}
              </td>
              {dt.visibleColumns.map((col, colIdx) => (
                <DataTableCell
                  key={`${table.id}-cell-${rowIndex}-${col.index}`}
                  formatted={dt.formatCell(row[col.index], col.index)}
                  alignment={dt.getCellAlignment(col.index)}
                  onCopy={handleCellCopy}
                  isSticky={colIdx === 0}
                  stickyClassName={`sticky left-[2.5rem] z-[1] ${rowIndex % 2 === 1 ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-900'}`}
                />
              ))}
            </tr>
          ))}
          {dt.pageRows.length === 0 && (
            <tr>
              <td
                colSpan={dt.visibleColumns.length + 1}
                className="px-3 py-10 text-center"
              >
                {dt.searchQuery ? (
                  <div className="flex flex-col items-center gap-2">
                    <MagnifyingGlass size={32} className="text-gray-300 dark:text-gray-600" weight="duotone" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('BiChat.DataTable.NoMatchingRows')}
                    </p>
                    <button
                      type="button"
                      onClick={() => dt.setSearchQuery('')}
                      className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {t('BiChat.DataTable.ClearSearchAction')}
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('BiChat.Table.NoRows')}
                  </span>
                )}
              </td>
            </tr>
          )}
        </tbody>
        {dt.showStats && (
          <DataTableFooter
            visibleColumns={dt.visibleColumns}
            stats={dt.columnStats}
            showRowNumbers
          />
        )}
      </table>
    </div>
  )

  const renderPagination = (idPrefix: string) => (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t('BiChat.Table.Showing', {
            from: String(from),
            to: String(to),
            total: String(dt.totalFilteredRows),
          })}
        </div>
        <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor={`${idPrefix}-page-size`}>
          {t('BiChat.Table.RowsLabel')}
        </label>
        <select
          id={`${idPrefix}-page-size`}
          value={dt.pageSize}
          onChange={(event) => dt.setPageSize(Number(event.target.value))}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          {dt.pageSizeOptions.map((option) => (
            <option key={`${idPrefix}-size-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <PaginationButton
          onClick={() => dt.setPage(1)}
          disabled={dt.page <= 1}
          aria-label={t('BiChat.DataTable.FirstPage')}
        >
          &laquo;
        </PaginationButton>
        <PaginationButton
          onClick={() => dt.setPage(Math.max(1, dt.page - 1))}
          disabled={dt.page <= 1}
          aria-label={t('BiChat.Table.Prev')}
        >
          &lsaquo;
        </PaginationButton>
        {getPageNumbers(dt.page, dt.totalPages).map((item, i) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400" aria-hidden>
              &hellip;
            </span>
          ) : (
            <PaginationButton
              key={item}
              onClick={() => dt.setPage(item)}
              active={item === dt.page}
              aria-current={item === dt.page ? 'page' : undefined}
            >
              {item}
            </PaginationButton>
          ),
        )}
        <PaginationButton
          onClick={() => dt.setPage(Math.min(dt.totalPages, dt.page + 1))}
          disabled={dt.page >= dt.totalPages}
          aria-label={t('BiChat.Table.Next')}
        >
          &rsaquo;
        </PaginationButton>
        <PaginationButton
          onClick={() => dt.setPage(dt.totalPages)}
          disabled={dt.page >= dt.totalPages}
          aria-label={t('BiChat.DataTable.LastPage')}
        >
          &raquo;
        </PaginationButton>
      </nav>
    </footer>
  )

  const renderTruncationNotice = () =>
    table.truncated ? (
      <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
        {t('BiChat.Table.TruncatedNotice')}
      </p>
    ) : null

  return (
    <>
      <section className="w-full min-w-0 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40 overflow-hidden">
        {renderToolbar(false)}
        {renderHeader()}
        {renderTable('max-h-[420px] overflow-auto')}
        {renderPagination(table.id)}
        {renderTruncationNotice()}
      </section>

      {isFullscreen && (
        <FullscreenOverlay
          title={table.title || t('BiChat.Table.QueryResults')}
          onClose={() => setIsFullscreen(false)}
          closeLabel={t('BiChat.DataTable.Collapse')}
        >
          {renderToolbar(true)}
          {renderHeader()}
          {renderTable('flex-1 overflow-auto')}
          {renderPagination(`${table.id}-fs`)}
          {renderTruncationNotice()}
        </FullscreenOverlay>
      )}
    </>
  )
})
