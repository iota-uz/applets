/**
 * StreamError Component
 * Error recovery UI for streaming failures
 */

import { motion } from 'framer-motion'
import { Warning, ArrowClockwise, ArrowsCounterClockwise, X } from '@phosphor-icons/react'
import { useTranslation } from '../hooks/useTranslation'

interface StreamErrorProps {
  /** Error message to display */
  error: string
  /** Callback to retry the failed operation */
  onRetry?: () => void
  /** Callback to regenerate the message */
  onRegenerate?: () => void
  /** Callback to dismiss the error */
  onDismiss?: () => void
  /** Whether to show compact mode (less padding) */
  compact?: boolean
}

export function StreamError({
  error,
  onRetry,
  onRegenerate,
  onDismiss,
  compact = false,
}: StreamErrorProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-start gap-3 ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 rounded-xl shadow-sm`}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/40">
        <Warning
          className="w-4 h-4 text-red-600 dark:text-red-400"
          weight="fill"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-800 dark:text-red-200 leading-snug">
          {t('BiChat.Error.Generic')}
        </p>
        <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-400/70 break-words leading-relaxed">
          {error}
        </p>
        <div className="flex items-center gap-2 mt-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600 rounded-lg transition-colors shadow-sm"
              type="button"
            >
              <ArrowClockwise className="w-3.5 h-3.5" />
              {t('BiChat.StreamError.Retry')}
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors shadow-sm"
              type="button"
            >
              <ArrowsCounterClockwise className="w-3.5 h-3.5" />
              {t('BiChat.StreamError.Regenerate')}
            </button>
          )}
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="cursor-pointer flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors"
          type="button"
          aria-label={t('BiChat.Chat.DismissNotification')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  )
}
