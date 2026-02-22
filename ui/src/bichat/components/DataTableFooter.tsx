import { memo } from 'react';
import type { ColumnMeta, ColumnStats } from '../hooks/useDataTable';
import { useTranslation } from '../hooks/useTranslation';

interface DataTableFooterProps {
  visibleColumns: ColumnMeta[]
  stats: Map<number, ColumnStats>
  showRowNumbers?: boolean
}

function formatStat(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

interface StatRowProps {
  label: string
  visibleColumns: ColumnMeta[]
  stats: Map<number, ColumnStats>
  getValue: (s: ColumnStats) => number
  showRowNumbers?: boolean
  odd?: boolean
}

const StatRow = memo(function StatRow({
  label,
  visibleColumns,
  stats,
  getValue,
  showRowNumbers,
  odd,
}: StatRowProps) {
  const zebra = odd ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850';
  return (
    <tr className={zebra}>
      {showRowNumbers && (
        <td colSpan={2} className={`sticky left-0 z-20 px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 select-none ${zebra}`}>
          {label}
        </td>
      )}
      {visibleColumns.map((col, colIdx) => {
        if (colIdx === 0 && showRowNumbers) {return null;}
        const s = stats.get(col.index);
        return (
          <td
            key={col.index}
            className={`px-3 py-1.5 text-xs ${
              col.type === 'number' ? 'text-right' : 'text-left'
            } text-gray-600 dark:text-gray-300`}
          >
            {s ? (
              <span className="font-mono tabular-nums font-medium">
                {formatStat(getValue(s))}
              </span>
            ) : null}
          </td>
        );
      })}
    </tr>
  );
});

export const DataTableFooter = memo(function DataTableFooter({
  visibleColumns,
  stats,
  showRowNumbers,
}: DataTableFooterProps) {
  const { t } = useTranslation();

  if (stats.size === 0) {return null;}

  return (
    <tfoot className="sticky bottom-0 z-10 border-t-2 border-gray-300 dark:border-gray-600">
      <StatRow
        label={t('BiChat.DataTable.StatsSum')}
        visibleColumns={visibleColumns}
        stats={stats}
        getValue={(s) => s.sum}
        showRowNumbers={showRowNumbers}
      />
      <StatRow
        label={t('BiChat.DataTable.StatsAvg')}
        visibleColumns={visibleColumns}
        stats={stats}
        getValue={(s) => s.avg}
        showRowNumbers={showRowNumbers}
        odd
      />
      <StatRow
        label={t('BiChat.DataTable.StatsMin')}
        visibleColumns={visibleColumns}
        stats={stats}
        getValue={(s) => s.min}
        showRowNumbers={showRowNumbers}
      />
      <StatRow
        label={t('BiChat.DataTable.StatsMax')}
        visibleColumns={visibleColumns}
        stats={stats}
        getValue={(s) => s.max}
        showRowNumbers={showRowNumbers}
        odd
      />
    </tfoot>
  );
});
