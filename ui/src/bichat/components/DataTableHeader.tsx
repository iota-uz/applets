import { memo, useCallback, useEffect, useRef } from 'react'
import { CaretUp, CaretDown, DotsThreeVertical } from '@phosphor-icons/react'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import type { ColumnMeta, SortState } from '../hooks/useDataTable'
import { useTranslation } from '../hooks/useTranslation'

const MIN_COLUMN_WIDTH = 40

interface DataTableHeaderProps {
  tableId: string
  columns: ColumnMeta[]
  sort: SortState | null
  onToggleSort: (columnIndex: number) => void
  onColumnResize: (columnIndex: number, width: number) => void
  onToggleVisibility: (columnIndex: number) => void
  onSendMessage?: (content: string) => void
  sendDisabled?: boolean
  showRowNumbers?: boolean
}

export const DataTableHeader = memo(function DataTableHeader({
  tableId,
  columns,
  sort,
  onToggleSort,
  onColumnResize,
  onToggleVisibility,
  onSendMessage,
  sendDisabled,
  showRowNumbers,
}: DataTableHeaderProps) {
  return (
    <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800">
      <tr className="border-b border-gray-200 dark:border-gray-700">
        {showRowNumbers && (
          <th scope="col" className="sticky left-0 z-20 w-10 bg-gray-100 px-2 py-2 text-right text-xs font-medium text-gray-400 dark:bg-gray-800 dark:text-gray-500 select-none">
            #
          </th>
        )}
        {columns.map((col, colIdx) => (
          <HeaderCell
            key={`${tableId}-header-${col.index}`}
            column={col}
            sort={sort}
            onToggleSort={onToggleSort}
            onColumnResize={onColumnResize}
            onToggleVisibility={onToggleVisibility}
            onSendMessage={onSendMessage}
            sendDisabled={sendDisabled}
            isFirstColumn={colIdx === 0 && !!showRowNumbers}
          />
        ))}
      </tr>
    </thead>
  )
})

interface HeaderCellProps {
  column: ColumnMeta
  sort: SortState | null
  onToggleSort: (columnIndex: number) => void
  onColumnResize: (columnIndex: number, width: number) => void
  onToggleVisibility: (columnIndex: number) => void
  onSendMessage?: (content: string) => void
  sendDisabled?: boolean
  isFirstColumn?: boolean
}

const HeaderCell = memo(function HeaderCell({
  column,
  sort,
  onToggleSort,
  onColumnResize,
  onToggleVisibility,
  onSendMessage,
  sendDisabled,
  isFirstColumn,
}: HeaderCellProps) {
  const { t } = useTranslation()
  const thRef = useRef<HTMLTableCellElement>(null)
  const resizeTeardownRef = useRef<(() => void) | null>(null)
  const isActive = sort?.columnIndex === column.index
  const direction = isActive ? sort.direction : null

  useEffect(() => {
    return () => {
      resizeTeardownRef.current?.()
      resizeTeardownRef.current = null
    }
  }, [])

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const th = thRef.current
      if (!th) return

      const startX = e.clientX
      const startWidth = th.offsetWidth
      const pointerId = e.pointerId
      const target = e.currentTarget as Element

      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX
        const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + delta)
        onColumnResize(column.index, newWidth)
      }

      const teardown = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onUp)
        resizeTeardownRef.current = null
        try {
          target.releasePointerCapture(pointerId)
        } catch {
          // ignore
        }
      }

      const onUp = () => teardown()

      resizeTeardownRef.current = teardown
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onUp)
      try {
        target.setPointerCapture(pointerId)
      } catch {
        // ignore
      }
    },
    [column.index, onColumnResize],
  )

  return (
    <th
      ref={thRef}
      scope="col"
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
      className={`group relative select-none whitespace-nowrap border-r border-transparent px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 ${
        isFirstColumn ? 'sticky left-[2.5rem] z-20 bg-gray-100 dark:bg-gray-800' : ''
      }`}
      style={column.width ? { width: column.width, minWidth: column.width } : undefined}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 hover:text-gray-900 dark:hover:text-white"
          onClick={() => onToggleSort(column.index)}
          aria-label={t('BiChat.DataTable.SortBy', { column: column.header })}
        >
          <span>{column.header}</span>
          {direction === 'asc' && <CaretUp size={12} weight="bold" />}
          {direction === 'desc' && <CaretDown size={12} weight="bold" />}
          {!direction && (
            <span className="w-3 opacity-0 transition-opacity group-hover:opacity-40">
              <CaretUp size={12} />
            </span>
          )}
        </button>

        {onSendMessage && (
          <Menu>
            <MenuButton
              className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-700"
              aria-label={t('BiChat.DataTable.ColumnActions')}
            >
              <DotsThreeVertical size={14} />
            </MenuButton>
            <MenuItems
              anchor="bottom end"
              className="z-50 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800 [--anchor-gap:4px]"
            >
              <MenuItem>
                {({ focus }) => (
                  <button
                    type="button"
                    className={`w-full px-3 py-1.5 text-left ${focus ? 'bg-gray-100 dark:bg-gray-700' : ''} text-gray-700 dark:text-gray-200`}
                    disabled={sendDisabled}
                    onClick={() => onSendMessage(t('BiChat.DataTable.Prompt.SummarizeColumn', { column: column.header }))}
                  >
                    {t('BiChat.DataTable.SummarizeColumn')}
                  </button>
                )}
              </MenuItem>
              <MenuItem>
                {({ focus }) => (
                  <button
                    type="button"
                    className={`w-full px-3 py-1.5 text-left ${focus ? 'bg-gray-100 dark:bg-gray-700' : ''} text-gray-700 dark:text-gray-200`}
                    disabled={sendDisabled}
                    onClick={() =>
                      onSendMessage(t('BiChat.DataTable.Prompt.UniqueValues', { column: column.header }))
                    }
                  >
                    {t('BiChat.DataTable.UniqueValues')}
                  </button>
                )}
              </MenuItem>
              <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
              <MenuItem>
                {({ focus }) => (
                  <button
                    type="button"
                    className={`w-full px-3 py-1.5 text-left ${focus ? 'bg-gray-100 dark:bg-gray-700' : ''} text-gray-700 dark:text-gray-200`}
                    onClick={() => onToggleVisibility(column.index)}
                  >
                    {t('BiChat.DataTable.HideColumn')}
                  </button>
                )}
              </MenuItem>
            </MenuItems>
          </Menu>
        )}
      </div>

      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('BiChat.DataTable.ResizeColumn')}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 transition-opacity hover:bg-blue-400 hover:opacity-100 group-hover:opacity-40"
        onPointerDown={handleResizeStart}
      />
    </th>
  )
})
