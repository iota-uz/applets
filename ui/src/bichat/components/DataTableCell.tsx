import { memo, useCallback, type KeyboardEvent } from 'react'
import type { FormattedCell } from '../utils/columnTypes'

interface DataTableCellProps {
  tableId: string
  rowIndex: number
  columnIndex: number
  formatted: FormattedCell
  alignment: 'left' | 'right'
  onCopy?: (value: string) => void
}

export const DataTableCell = memo(function DataTableCell({
  tableId: _tableId,
  rowIndex: _rowIndex,
  columnIndex: _columnIndex,
  formatted,
  alignment,
  onCopy,
}: DataTableCellProps) {
  const handleClick = useCallback(() => {
    if (!onCopy) return
    const text = formatted.isNull ? '' : String(formatted.raw ?? formatted.display)
    onCopy(text)
  }, [onCopy, formatted])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!onCopy) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [onCopy, handleClick],
  )

  return (
    <td
      className={`px-3 py-2 align-top ${alignment === 'right' ? 'text-right' : 'text-left'}`}
      onClick={onCopy ? handleClick : undefined}
      onKeyDown={onCopy ? handleKeyDown : undefined}
      role={onCopy ? 'button' : undefined}
      tabIndex={onCopy ? 0 : undefined}
    >
      {formatted.isNull ? (
        <span className="text-xs italic text-gray-400 dark:text-gray-500">NULL</span>
      ) : formatted.type === 'boolean' ? (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            formatted.display === 'true'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {formatted.display}
        </span>
      ) : formatted.type === 'url' ? (
        <a
          href={formatted.display}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block max-w-[420px] truncate">{formatted.display}</span>
        </a>
      ) : formatted.type === 'number' ? (
        <span className="block font-mono text-gray-700 dark:text-gray-300 tabular-nums" title={String(formatted.raw)}>
          {formatted.display}
        </span>
      ) : formatted.type === 'date' ? (
        <span className="block text-gray-700 dark:text-gray-300" title={String(formatted.raw)}>
          {formatted.display}
        </span>
      ) : (
        <span className="block max-w-[420px] truncate text-gray-700 dark:text-gray-300" title={formatted.display}>
          {formatted.display}
        </span>
      )}
    </td>
  )
})
