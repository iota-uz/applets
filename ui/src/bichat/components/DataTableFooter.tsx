import { memo } from 'react'
import type { ColumnMeta, ColumnStats } from '../hooks/useDataTable'
import { useTranslation } from '../hooks/useTranslation'

interface DataTableFooterProps {
  visibleColumns: ColumnMeta[]
  stats: Map<number, ColumnStats>
  showRowNumbers?: boolean
}

function formatStat(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

export const DataTableFooter = memo(function DataTableFooter({
  visibleColumns,
  stats,
  showRowNumbers,
}: DataTableFooterProps) {
  const { t } = useTranslation()

  if (stats.size === 0) return null

  return (
    <tfoot className="sticky bottom-0 z-10 bg-gray-100 dark:bg-gray-800">
      <tr className="border-t border-gray-200 dark:border-gray-700" aria-label={t('BiChat.DataTable.SummaryRow')}>
        {showRowNumbers && (
          <td className="sticky left-0 z-20 w-10 bg-gray-100 px-2 py-2 dark:bg-gray-800" />
        )}
        {visibleColumns.map((col, colIdx) => {
          const s = stats.get(col.index)
          return (
            <td
              key={col.index}
              className={`px-3 py-2 text-xs font-medium ${
                col.type === 'number' ? 'text-right' : 'text-left'
              } text-gray-600 dark:text-gray-300 ${
                colIdx === 0 && showRowNumbers ? 'sticky left-[2.5rem] z-20 bg-gray-100 dark:bg-gray-800' : ''
              }`}
            >
              {s ? (
                <span className="font-mono tabular-nums" title={`Sum: ${formatStat(s.sum)} | Avg: ${formatStat(s.avg)} | Min: ${formatStat(s.min)} | Max: ${formatStat(s.max)}`}>
                  {formatStat(s.sum)}
                </span>
              ) : (
                <span className="text-gray-400 dark:text-gray-600">&mdash;</span>
              )}
            </td>
          )
        })}
      </tr>
    </tfoot>
  )
})
