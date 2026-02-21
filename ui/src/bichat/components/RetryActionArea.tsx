/**
 * RetryActionArea Component
 * Displays a retry action area inline where the assistant message would appear
 * (typically after an interrupted request or connection loss)
 *
 * Styled to match assistant message positioning (left-aligned) so users see
 * the retry button contextually in the conversation flow.
 */

import { memo } from 'react'
import { motion } from 'framer-motion'
import { ArrowClockwise, Warning } from '@phosphor-icons/react'
import { useTranslation } from '../hooks/useTranslation'

interface RetryActionAreaProps {
  /** Callback when retry button is clicked */
  onRetry: () => void
}

export const RetryActionArea = memo(function RetryActionArea({
  onRetry,
}: RetryActionAreaProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className="flex justify-start"
    >
      <div
        className="flex flex-col gap-2.5 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2.5">
          <Warning
            className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0"
            weight="fill"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('BiChat.Retry.Subtitle')}
          </span>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        >
          <ArrowClockwise size={14} />
          {t('BiChat.Retry.Button')}
        </button>
      </div>
    </motion.div>
  )
})

export default RetryActionArea
