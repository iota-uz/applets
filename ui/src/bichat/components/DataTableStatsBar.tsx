import { memo } from 'react'
import type { ColumnMeta, ColumnStats } from '../hooks/useDataTable'
import { useTranslation } from '../hooks/useTranslation'

interface DataTableStatsBarProps {
  columns: ColumnMeta[]
  stats: Map<number, ColumnStats>
}

function formatStat(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

export const DataTableStatsBar = memo(function DataTableStatsBar({
  columns,
  stats,
}: DataTableStatsBarProps) {
  const { t } = useTranslation()

  if (stats.size === 0) return null

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/60">
      <div className="flex flex-wrap gap-4">
        {columns.map((col) => {
          const s = stats.get(col.index)
          if (!s) return null
          return (
            <div key={col.index} className="min-w-0">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{col.header}</span>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                <span>{t('BiChat.DataTable.StatsSum')}: <b className="font-mono tabular-nums">{formatStat(s.sum)}</b></span>
                <span>{t('BiChat.DataTable.StatsAvg')}: <b className="font-mono tabular-nums">{formatStat(s.avg)}</b></span>
                <span>{t('BiChat.DataTable.StatsMin')}: <b className="font-mono tabular-nums">{formatStat(s.min)}</b></span>
                <span>{t('BiChat.DataTable.StatsMax')}: <b className="font-mono tabular-nums">{formatStat(s.max)}</b></span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
