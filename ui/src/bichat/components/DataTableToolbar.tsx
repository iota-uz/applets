import { memo, useCallback, useState } from 'react'
import { ChartBar, Columns, ChartLineUp, X } from '@phosphor-icons/react'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
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
      <Menu>
        <MenuButton
          className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
            hasHiddenColumns
              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
          aria-label={t('BiChat.DataTable.ToggleColumns')}
        >
          <Columns size={14} />
          <span>{t('BiChat.DataTable.Columns')}</span>
        </MenuButton>
        <MenuItems
          anchor="bottom start"
          className="z-50 max-h-64 min-w-[180px] overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800 [--anchor-gap:4px]"
        >
          {hasHiddenColumns && (
            <>
              <MenuItem>
                {({ focus }) => (
                  <button
                    type="button"
                    className={`w-full px-3 py-1.5 text-left text-xs font-medium text-blue-600 dark:text-blue-400 ${focus ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                    onClick={onResetColumnVisibility}
                  >
                    {t('BiChat.DataTable.ShowAllColumns')}
                  </button>
                )}
              </MenuItem>
              <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
            </>
          )}
          {columns.map((col) => (
            <MenuItem key={col.index}>
              {({ focus }) => (
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${focus ? 'bg-gray-100 dark:bg-gray-700' : ''} text-gray-700 dark:text-gray-200`}
                  onClick={() => onToggleColumnVisibility(col.index)}
                >
                  <input
                    type="checkbox"
                    checked={col.visible}
                    readOnly
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-600"
                  />
                  <span className="truncate text-xs">{col.header}</span>
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Menu>

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
          onClick={() => onSendMessage('Create a chart visualization from this data')}
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
