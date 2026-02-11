/**
 * StreamingCursor Component
 * Animated cursor shown during AI response streaming
 */

import { useTranslation } from '../hooks/useTranslation'

function StreamingCursor() {
  const { t } = useTranslation()
  return (
    <span
      className="inline-block w-1.5 h-4 ml-0.5 bg-primary-600 dark:bg-primary-500 animate-pulse"
      aria-label={t('BiChat.Common.AITyping')}
    />
  )
}

export { StreamingCursor }
export default StreamingCursor
