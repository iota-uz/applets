export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'url' | 'null'

export interface FormattedCell {
  display: string
  raw: unknown
  type: ColumnType
  isNull: boolean
}

const URL_PATTERN = /^https?:\/\//i
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?)?$/
const MAX_SAMPLE = 20

export function inferColumnType(values: unknown[], backendHint?: string): ColumnType {
  if (backendHint) {
    switch (backendHint) {
      case 'number':
        return 'number'
      case 'boolean':
        return 'boolean'
      case 'date':
        return 'date'
      default:
        return 'string'
    }
  }

  const nonNull = values.filter((v) => v !== null && v !== undefined)
  if (nonNull.length === 0) return 'null'

  const sample = nonNull.slice(0, MAX_SAMPLE)

  if (sample.every((v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))))) {
    return 'number'
  }

  if (sample.every((v) => typeof v === 'boolean' || v === 'true' || v === 'false')) {
    return 'boolean'
  }

  if (sample.every((v) => typeof v === 'string' && ISO_DATE_PATTERN.test(v))) {
    return 'date'
  }

  if (sample.length > 0 && sample.every((v) => typeof v === 'string' && URL_PATTERN.test(v))) {
    return 'url'
  }

  return 'string'
}

export function formatCellValue(value: unknown, type: ColumnType): FormattedCell {
  if (value === null || value === undefined) {
    return { display: 'NULL', raw: value, type, isNull: true }
  }

  switch (type) {
    case 'number': {
      const num = typeof value === 'number' ? value : Number(value)
      if (!isFinite(num)) {
        return { display: String(value), raw: value, type, isNull: false }
      }
      const display = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 6,
      }).format(num)
      return { display, raw: value, type, isNull: false }
    }

    case 'boolean': {
      const bool = typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true'
      return { display: bool ? 'true' : 'false', raw: value, type, isNull: false }
    }

    case 'date': {
      const str = String(value)
      const date = new Date(str)
      if (isNaN(date.getTime())) {
        return { display: str, raw: value, type, isNull: false }
      }
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffDays = Math.abs(diffMs) / (1000 * 60 * 60 * 24)
      let display: string
      if (diffDays < 1) {
        display = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      } else if (diffDays < 365) {
        display = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      } else {
        display = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      }
      return { display, raw: value, type, isNull: false }
    }

    case 'url': {
      return { display: String(value), raw: value, type, isNull: false }
    }

    default: {
      const str = typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)
      return { display: str, raw: value, type, isNull: false }
    }
  }
}
