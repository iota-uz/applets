/**
 * Error display utilities for structured RPC error handling.
 * Distinguishes permission-denied errors (amber styling) from generic errors (red styling).
 */

export interface RPCErrorDisplay {
  title: string
  description: string
  isPermissionDenied: boolean
}

/**
 * Check whether an error represents a permission-denied / forbidden response.
 */
export function isPermissionDeniedError(error: unknown): boolean {
  if (!error) return false

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('forbidden') || msg.includes('permission denied')) return true
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>

    // RPC error shape: { code: 'forbidden' } or { status: 403 }
    if (obj.code === 'forbidden' || obj.code === 403) return true
    if (obj.status === 403) return true
    if (obj.statusCode === 403) return true

    // Nested response: { response: { status: 403 } }
    if (typeof obj.response === 'object' && obj.response !== null) {
      const resp = obj.response as Record<string, unknown>
      if (resp.status === 403) return true
    }
  }

  if (typeof error === 'string') {
    const lower = error.toLowerCase()
    if (lower.includes('forbidden') || lower.includes('permission denied')) return true
  }

  return false
}

/**
 * Convert an unknown error into a structured display object.
 */
export function toErrorDisplay(error: unknown, fallbackTitle: string): RPCErrorDisplay {
  const permDenied = isPermissionDeniedError(error)

  let title = fallbackTitle
  let description = ''

  if (error instanceof Error) {
    description = error.message
  } else if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>
    if (typeof obj.message === 'string' && obj.message) description = obj.message
    if (typeof obj.title === 'string' && obj.title) title = obj.title
    // RFC 7807 detail takes precedence when non-empty
    if (typeof obj.detail === 'string' && obj.detail) description = obj.detail
  } else if (typeof error === 'string') {
    description = error
  }

  if (permDenied && !description) {
    description = 'Your account does not have permission for this action.'
  }

  return { title, description, isPermissionDenied: permDenied }
}
