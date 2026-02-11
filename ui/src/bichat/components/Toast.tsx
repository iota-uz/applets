/**
 * Toast Component
 * Individual toast notification with auto-dismiss, progress bar, and accessibility.
 * Uses @headlessui/react Transition for CSS-driven enter/leave animations.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Transition } from '@headlessui/react'
import { CheckCircle, XCircle, Info, Warning, X } from '@phosphor-icons/react'
import type { ToastType } from '../hooks/useToast'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  onDismiss: (id: string) => void
  /** Label for dismiss button (defaults to "Dismiss") */
  dismissLabel?: string
}

const typeConfig: Record<
  ToastType,
  { accent: string; bg: string; icon: string; progress: string; iconEl: typeof CheckCircle }
> = {
  success: {
    accent: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/50',
    icon: 'bg-emerald-100 dark:bg-emerald-900/50',
    progress: 'bg-emerald-500 dark:bg-emerald-400',
    iconEl: CheckCircle,
  },
  error: {
    accent: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40 border-red-200/80 dark:border-red-800/50',
    icon: 'bg-red-100 dark:bg-red-900/50',
    progress: 'bg-red-500 dark:bg-red-400',
    iconEl: XCircle,
  },
  info: {
    accent: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/50',
    icon: 'bg-blue-100 dark:bg-blue-900/50',
    progress: 'bg-blue-500 dark:bg-blue-400',
    iconEl: Info,
  },
  warning: {
    accent: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/50',
    icon: 'bg-amber-100 dark:bg-amber-900/50',
    progress: 'bg-amber-500 dark:bg-amber-400',
    iconEl: Warning,
  },
}

export function Toast({
  id,
  type,
  message,
  duration = 5000,
  onDismiss,
  dismissLabel = 'Dismiss notification',
}: ToastProps) {
  const config = typeConfig[type]
  const Icon = config.iconEl
  const [show, setShow] = useState(false)
  const [paused, setPaused] = useState(false)
  const remainingRef = useRef(duration)
  const startRef = useRef(Date.now())

  // Trigger enter transition on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Auto-dismiss with pause/resume on hover
  useEffect(() => {
    if (paused) return

    startRef.current = Date.now()
    const timer = setTimeout(() => {
      setShow(false)
      // Wait for leave transition before removing from DOM
      setTimeout(() => onDismiss(id), 200)
    }, remainingRef.current)

    return () => {
      // Capture how much time remains when pausing
      const elapsed = Date.now() - startRef.current
      remainingRef.current = Math.max(0, remainingRef.current - elapsed)
      clearTimeout(timer)
    }
  }, [id, paused, onDismiss])

  const handleDismiss = useCallback(() => {
    setShow(false)
    setTimeout(() => onDismiss(id), 200)
  }, [id, onDismiss])

  const ariaLive = type === 'error' ? 'assertive' : 'polite'
  const role = type === 'error' || type === 'warning' ? 'alert' : 'status'

  return (
    <Transition
      show={show}
      enter="transition duration-200 ease-out"
      enterFrom="-translate-y-2 opacity-0 scale-95"
      enterTo="translate-y-0 opacity-100 scale-100"
      leave="transition duration-150 ease-in"
      leaveFrom="translate-y-0 opacity-100 scale-100"
      leaveTo="-translate-y-2 opacity-0 scale-95"
    >
      <div
        className={`relative flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-black/5 dark:shadow-black/20 backdrop-blur-sm min-w-[320px] max-w-[420px] overflow-hidden ${config.bg}`}
        role={role}
        aria-live={ariaLive}
        aria-atomic="true"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Icon */}
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.icon}`}>
          <Icon size={16} className={config.accent} weight="fill" />
        </div>

        {/* Message */}
        <p className="flex-1 pt-0.5 text-sm font-medium leading-snug text-gray-800 dark:text-gray-100">
          {message}
        </p>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="mt-0.5 -mr-1 cursor-pointer shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700/60 transition-colors duration-100"
          aria-label={dismissLabel}
        >
          <X size={14} weight="bold" />
        </button>

        {/* Progress bar */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/5 dark:bg-white/5">
          <div
            className={`h-full ${config.progress} origin-left`}
            style={{
              animation: `bichat-toast-progress ${duration}ms linear forwards`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          />
        </div>
      </div>
    </Transition>
  )
}

export default Toast
