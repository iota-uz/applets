/**
 * useToast Hook
 * Manages toast notification state
 */

import { useState, useCallback, useRef } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration?: number
  action?: ToastAction
}

export interface UseToastReturn {
  toasts: ToastItem[]
  success: (msg: string, duration?: number, action?: ToastAction) => void
  error: (msg: string, duration?: number, action?: ToastAction) => void
  info: (msg: string, duration?: number, action?: ToastAction) => void
  warning: (msg: string, duration?: number, action?: ToastAction) => void
  dismiss: (id: string) => void
  dismissAll: () => void
}

/**
 * Generate a unique ID for a toast
 */
function generateId(): string {
  return Math.random().toString(36).substring(7)
}

const DEDUPE_WINDOW_MS = 2500
const MAX_ACTIVE_TOASTS = 5

/**
 * Hook for managing toast notifications
 *
 * @example
 * ```tsx
 * const { toasts, success, error, dismiss } = useToast()
 *
 * // Show a success toast
 * success('Operation completed!')
 *
 * // Show an error toast with custom duration
 * error('Something went wrong', 10000)
 *
 * // Render toasts
 * <ToastContainer toasts={toasts} onDismiss={dismiss} />
 * ```
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const recentToastMapRef = useRef<Map<string, number>>(new Map())

  const showToast = useCallback(
    (type: ToastType, message: string, duration?: number, action?: ToastAction) => {
      const normalizedMessage = message.trim().toLowerCase()
      const key = `${type}:${normalizedMessage}`
      const now = Date.now()
      const lastShownAt = recentToastMapRef.current.get(key)
      if (lastShownAt && now - lastShownAt < DEDUPE_WINDOW_MS) {
        return
      }

      // Drop old dedupe entries to keep map small.
      for (const [mapKey, ts] of recentToastMapRef.current.entries()) {
        if (now - ts > DEDUPE_WINDOW_MS * 4) {
          recentToastMapRef.current.delete(mapKey)
        }
      }
      recentToastMapRef.current.set(key, now)

      const id = generateId()
      setToasts((prev) => {
        const next = [...prev, { id, type, message, duration, action }]
        if (next.length <= MAX_ACTIVE_TOASTS) return next
        return next.slice(next.length - MAX_ACTIVE_TOASTS)
      })
    },
    []
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
    recentToastMapRef.current.clear()
  }, [])

  const success = useCallback(
    (msg: string, duration?: number, action?: ToastAction) => showToast('success', msg, duration, action),
    [showToast],
  )
  const error = useCallback(
    (msg: string, duration?: number, action?: ToastAction) => showToast('error', msg, duration, action),
    [showToast],
  )
  const info = useCallback(
    (msg: string, duration?: number, action?: ToastAction) => showToast('info', msg, duration, action),
    [showToast],
  )
  const warning = useCallback(
    (msg: string, duration?: number, action?: ToastAction) => showToast('warning', msg, duration, action),
    [showToast],
  )

  return {
    toasts,
    success,
    error,
    info,
    warning,
    dismiss,
    dismissAll,
  }
}
