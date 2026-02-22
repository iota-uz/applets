import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RenderTableData } from '../types'
import { type ColumnType, type FormattedCell, inferColumnType, formatCellValue } from '../utils/columnTypes'

export interface ColumnMeta {
  index: number
  name: string
  header: string
  type: ColumnType
  width: number | null
  visible: boolean
}

export interface SortState {
  columnIndex: number
  direction: 'asc' | 'desc'
}

export interface ColumnStats {
  sum: number
  avg: number
  min: number
  max: number
  count: number
  nullCount: number
}

export interface DataTableOptions {
  defaultPageSize?: number
  enableSearch?: boolean
  enableSort?: boolean
  enableResize?: boolean
  enableColumnVisibility?: boolean
  enableStats?: boolean
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200]

export interface UseDataTableReturn {
  columns: ColumnMeta[]
  visibleColumns: ColumnMeta[]

  page: number
  pageSize: number
  totalPages: number
  totalFilteredRows: number
  pageSizeOptions: number[]
  pageRows: unknown[][]
  setPage: (page: number) => void
  setPageSize: (size: number) => void

  sort: SortState | null
  toggleSort: (columnIndex: number) => void
  clearSort: () => void

  searchQuery: string
  setSearchQuery: (query: string) => void

  showStats: boolean
  setShowStats: (show: boolean) => void
  columnStats: Map<number, ColumnStats>

  toggleColumnVisibility: (columnIndex: number) => void
  resetColumnVisibility: () => void

  setColumnWidth: (columnIndex: number, width: number) => void

  formatCell: (value: unknown, columnIndex: number) => FormattedCell
  getCellAlignment: (columnIndex: number) => 'left' | 'right'

  getTableAsTSV: () => string
}

export function useDataTable(
  table: RenderTableData,
  options?: DataTableOptions,
): UseDataTableReturn {
  const defaultPageSize = Math.min(Math.max(table.pageSize || options?.defaultPageSize || 25, 1), 200)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [sort, setSort] = useState<SortState | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showStats, setShowStats] = useState(false)
  const [columnVisibility, setColumnVisibility] = useState<Map<number, boolean>>(new Map())
  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map())

  // Reset state when table identity changes
  useEffect(() => {
    setPage(1)
    setPageSize(Math.min(Math.max(table.pageSize || options?.defaultPageSize || 25, 1), 200))
    setSort(null)
    setSearchQuery('')
    setShowStats(false)
    setColumnVisibility(new Map())
    setColumnWidths(new Map())
  }, [table.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Type inference depends only on table data
  const columnTypes = useMemo(() => {
    return table.columns.map((_, index) => {
      const backendHint = table.columnTypes?.[index]
      const columnValues = table.rows.map((row) => row[index])
      return inferColumnType(columnValues, backendHint)
    })
  }, [table.columns, table.rows, table.columnTypes])

  // Column metadata: types + width/visibility
  const columns: ColumnMeta[] = useMemo(() => {
    return table.columns.map((name, index) => ({
      index,
      name,
      header: table.headers[index] || name,
      type: columnTypes[index],
      width: columnWidths.get(index) ?? null,
      visible: columnVisibility.get(index) ?? true,
    }))
  }, [table.columns, table.headers, columnTypes, columnWidths, columnVisibility])

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns])

  // Apply search filter
  const searchFilteredRows = useMemo(() => {
    if (!searchQuery.trim()) return table.rows
    const query = searchQuery.toLowerCase()
    const visibleIndices = new Set(visibleColumns.map((c) => c.index))
    return table.rows.filter((row) =>
      row.some((cell, i) => {
        if (!visibleIndices.has(i)) return false
        if (cell === null || cell === undefined) return false
        return String(cell).toLowerCase().includes(query)
      }),
    )
  }, [table.rows, searchQuery, visibleColumns])

  // Apply sort
  const sortedRows = useMemo(() => {
    if (!sort) return searchFilteredRows

    const col = columns[sort.columnIndex]
    if (!col) return searchFilteredRows

    const sorted = [...searchFilteredRows]
    const colIdx = sort.columnIndex
    const dir = sort.direction === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      const aVal = a[colIdx]
      const bVal = b[colIdx]

      // Nulls always last
      const aNull = aVal === null || aVal === undefined
      const bNull = bVal === null || bVal === undefined
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1

      switch (col.type) {
        case 'number': {
          const aNum = typeof aVal === 'number' ? aVal : Number(aVal)
          const bNum = typeof bVal === 'number' ? bVal : Number(bVal)
          if (isNaN(aNum) && isNaN(bNum)) return 0
          if (isNaN(aNum)) return 1
          if (isNaN(bNum)) return -1
          return (aNum - bNum) * dir
        }
        case 'date': {
          const aTime = new Date(String(aVal)).getTime()
          const bTime = new Date(String(bVal)).getTime()
          if (isNaN(aTime) && isNaN(bTime)) return 0
          if (isNaN(aTime)) return 1
          if (isNaN(bTime)) return -1
          return (aTime - bTime) * dir
        }
        case 'boolean': {
          const aBool = aVal === true || aVal === 'true' ? 1 : 0
          const bBool = bVal === true || bVal === 'true' ? 1 : 0
          return (aBool - bBool) * dir
        }
        default: {
          return String(aVal).localeCompare(String(bVal)) * dir
        }
      }
    })

    return sorted
  }, [searchFilteredRows, sort, columns])

  const totalFilteredRows = sortedRows.length

  // Compute stats on filtered numeric columns (only visible columns when stats are shown)
  const columnStats = useMemo<Map<number, ColumnStats>>(() => {
    if (!showStats) return new Map()

    const stats = new Map<number, ColumnStats>()
    for (const col of visibleColumns) {
      if (col.type !== 'number') continue
      let sum = 0
      let min = Infinity
      let max = -Infinity
      let count = 0
      let nullCount = 0

      for (const row of sortedRows) {
        const val = row[col.index]
        if (val === null || val === undefined) {
          nullCount++
          continue
        }
        const num = typeof val === 'number' ? val : Number(val)
        if (isNaN(num)) continue
        sum += num
        min = Math.min(min, num)
        max = Math.max(max, num)
        count++
      }

      if (count > 0) {
        stats.set(col.index, {
          sum,
          avg: sum / count,
          min,
          max,
          count,
          nullCount,
        })
      }
    }
    return stats
  }, [showStats, visibleColumns, sortedRows])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalFilteredRows / pageSize))

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [page, pageSize, sortedRows])

  const pageSizeOptions = useMemo(() => {
    const set = new Set([...PAGE_SIZE_OPTIONS, defaultPageSize])
    return [...set].sort((a, b) => a - b)
  }, [defaultPageSize])

  // Reset page on search/sort change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, sort])

  // Actions
  const toggleSort = useCallback(
    (columnIndex: number) => {
      if (options?.enableSort === false) return
      setSort((prev) => {
        if (!prev || prev.columnIndex !== columnIndex) {
          return { columnIndex, direction: 'asc' }
        }
        if (prev.direction === 'asc') {
          return { columnIndex, direction: 'desc' }
        }
        return null
      })
    },
    [options?.enableSort],
  )

  const handleSetSearchQuery = useCallback(
    (query: string) => {
      if (options?.enableSearch === false) return
      setSearchQuery(query)
    },
    [options?.enableSearch],
  )

  const toggleColumnVisibility = useCallback(
    (columnIndex: number) => {
      if (options?.enableColumnVisibility === false) return
      const numColumns = table.columns.length
      setColumnVisibility((prev) => {
        const next = new Map(prev)
        const currentlyVisible = prev.get(columnIndex) ?? true
        if (currentlyVisible) {
          let visibleCount = 0
          for (let i = 0; i < numColumns; i++) {
            if (prev.get(i) ?? true) visibleCount++
          }
          if (visibleCount <= 1) return prev
        }
        next.set(columnIndex, !currentlyVisible)
        return next
      })
    },
    [options?.enableColumnVisibility, table.columns.length],
  )

  const resetColumnVisibility = useCallback(() => {
    setColumnVisibility(new Map())
  }, [])

  const setColumnWidthCb = useCallback(
    (columnIndex: number, width: number) => {
      if (options?.enableResize === false) return
      setColumnWidths((prev) => {
        const next = new Map(prev)
        next.set(columnIndex, Math.max(60, width))
        return next
      })
    },
    [options?.enableResize],
  )

  const formatCell = useCallback(
    (value: unknown, columnIndex: number): FormattedCell => {
      const type = columnTypes[columnIndex] ?? 'string'
      return formatCellValue(value, type)
    },
    [columnTypes],
  )

  const getCellAlignment = useCallback(
    (columnIndex: number): 'left' | 'right' => {
      return columnTypes[columnIndex] === 'number' ? 'right' : 'left'
    },
    [columnTypes],
  )

  const clearSort = useCallback(() => setSort(null), [])

  const handleSetPageSize = useCallback(
    (size: number) => {
      setPageSize(size)
      setPage(1)
    },
    [],
  )

  const getTableAsTSV = useCallback((): string => {
    const escape = (v: string) => v.replace(/[\t\r\n]/g, ' ')
    const visCols = columns.filter((c) => c.visible)
    const headerRow = visCols.map((c) => escape(c.header)).join('\t')
    const dataRows = sortedRows.map((row) =>
      visCols.map((c) => {
        const val = row[c.index]
        if (val === null || val === undefined) return ''
        return escape(String(val))
      }).join('\t'),
    )
    return [headerRow, ...dataRows].join('\n')
  }, [columns, sortedRows])

  return {
    columns,
    visibleColumns,

    page,
    pageSize,
    totalPages,
    totalFilteredRows,
    pageSizeOptions,
    pageRows,
    setPage,
    setPageSize: handleSetPageSize,

    sort,
    toggleSort,
    clearSort,

    searchQuery,
    setSearchQuery: handleSetSearchQuery,

    showStats,
    setShowStats,
    columnStats,

    toggleColumnVisibility,
    resetColumnVisibility,

    setColumnWidth: setColumnWidthCb,

    formatCell,
    getCellAlignment,

    getTableAsTSV,
  }
}
