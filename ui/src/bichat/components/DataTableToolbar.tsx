import { memo, useCallback, useState } from 'react'
import { ChartBar, Columns, ChartLineUp, X, Check } from '@phosphor-icons/react'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import type { ColumnMeta } from '../hooks/useDataTable'
import { useTranslation } from '../hooks/useTranslation'

interface DataTableToolbarProps {
  columns: ColumnMeta[]
  searchQuery: string
  onSearchChange: (query: string) => void
  showStats: boolean
  onToggleStats: (show: boolean) => void
  onToggleColumnVisibility: (columnIndex: number) => void
  onResetColumnVisibility: () => void
  onSendMessage?: (content: string) => void
  sendDisabled?: boolean
  hasHiddenColumns: boolean
}

export const DataTableToolbar = memo(function DataTableToolbar({
  columns,
  searchQuery,
  onSearchChange,
  showStats,
  onToggleStats,
  onToggleColumnVisibility,
  onResetColumnVisibility,
  onSendMessage,
  sendDisabled,
  hasHiddenColumns,
}: DataTableToolbarProps) {
  const { t } = useTranslation()
  const [searchFocused, setSearchFocused] = useState(false)

  const handleSearchClear = useCallback(() => {
    onSearchChange('')
  }, [onSearchChange])

  const hasSearch = searchQuery.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
      {/* Search */}
      <div className={`relative flex items-center transition-all ${searchFocused || hasSearch ? 'w-48' : 'w-32'}`}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder={t('BiChat.DataTable.Search')}
          className="w-full rounded-md border border-gray-300 bg-white py-1 pl-2 pr-7 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
          aria-label={t('BiChat.DataTable.SearchRows')}
        />
        {hasSearch && (
          <button
            type="button"
            onClick={handleSearchClear}
            className="absolute right-1.5 cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={t('BiChat.DataTable.ClearSearch')}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Column visibility */}
      <Popover className="relative">
        <PopoverButton
          className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
            hasHiddenColumns
              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
          aria-label={t('BiChat.DataTable.ToggleColumns')}
        >
          <Columns size={14} />
          <span>{t('BiChat.DataTable.Columns')}</span>
        </PopoverButton>
        <PopoverPanel
          anchor="bottom start"
          className="z-50 mt-1 max-h-72 min-w-[200px] overflow-auto rounded-lg border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {hasHiddenColumns && (
            <>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-gray-50 dark:text-blue-400 dark:hover:bg-gray-700"
                onClick={onResetColumnVisibility}
              >
                {t('BiChat.DataTable.ShowAllColumns')}
              </button>
              <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
            </>
          )}
          {columns.map((col) => (
            <button
              key={col.index}
              type="button"
              role="checkbox"
              aria-checked={col.visible}
              className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60"
              onClick={() => onToggleColumnVisibility(col.index)}
            >
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
                  col.visible
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 bg-white dark:border-gray-500 dark:bg-gray-700'
                }`}
              >
                {col.visible && <Check size={11} weight="bold" />}
              </span>
              <span className="truncate">{col.header}</span>
            </button>
          ))}
        </PopoverPanel>
      </Popover>

      {/* Stats toggle */}
      <button
        type="button"
        onClick={() => onToggleStats(!showStats)}
        className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
          showStats
            ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
            : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
        }`}
        aria-label={t('BiChat.DataTable.ToggleStats')}
      >
        <ChartBar size={14} />
        <span>{t('BiChat.DataTable.Stats')}</span>
      </button>

      {/* Visualize */}
      {onSendMessage && (
        <button
          type="button"
          disabled={sendDisabled}
          onClick={() => onSendMessage(t('BiChat.DataTable.Prompt.VisualizeChart'))}
          className="flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label={t('BiChat.DataTable.Visualize')}
        >
          <ChartLineUp size={14} />
          <span>{t('BiChat.DataTable.Visualize')}</span>
        </button>
      )}
    </div>
  )
})
