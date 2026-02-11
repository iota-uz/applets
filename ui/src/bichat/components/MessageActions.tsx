import { useState, memo } from 'react'
import { Copy, ArrowClockwise, PencilSimple } from '@phosphor-icons/react'
import { MessageRole } from '../types'
import { useToast } from '../hooks/useToast'
import { useTranslation } from '../hooks/useTranslation'
import LoadingSpinner from './LoadingSpinner'

interface ActionableMessage {
  id: string
  role: MessageRole
  content: string
}

interface MessageActionsProps {
  message: ActionableMessage
  onCopy: (text: string) => Promise<void>
  onRegenerate?: (messageId: string) => Promise<void>
  onEdit?: (message: ActionableMessage) => void
}

function MessageActions({
  message,
  onCopy,
  onRegenerate,
  onEdit,
}: MessageActionsProps) {
  const [copying, setCopying] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const toast = useToast()
  const { t } = useTranslation()

  const isUser = message.role === MessageRole.User

  const handleCopy = async () => {
    setCopying(true)
    try {
      await onCopy(message.content)
      toast.success(t('BiChat.Message.CopiedToClipboard'))
    } catch {
      toast.error(t('BiChat.Message.FailedToCopy'))
    } finally {
      setCopying(false)
    }
  }

  const handleRegenerate = async () => {
    if (!onRegenerate) return
    setRegenerating(true)
    try {
      await onRegenerate(message.id)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        disabled={copying}
        title={copying ? t('BiChat.Message.Copying') : t('BiChat.Message.CopyMessage')}
        className="cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-colors disabled:opacity-50 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        aria-label={copying ? t('BiChat.Message.Copying') : t('BiChat.Message.CopyMessage')}
      >
        {copying ? (
          <LoadingSpinner variant="spinner" size="sm" />
        ) : (
          <Copy size={16} className="w-4 h-4" />
        )}
      </button>

      {/* Regenerate button (AI messages only) */}
      {!isUser && onRegenerate && (
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          title={regenerating ? t('BiChat.Message.Regenerating') : t('BiChat.Message.Regenerate')}
          className="cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-colors disabled:opacity-50 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          aria-label={regenerating ? t('BiChat.Message.Regenerating') : t('BiChat.Message.Regenerate')}
        >
          {regenerating ? (
            <LoadingSpinner variant="spinner" size="sm" />
          ) : (
            <ArrowClockwise size={16} className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Edit button (user messages only) */}
      {isUser && onEdit && (
        <button
          onClick={() => onEdit(message)}
          title={t('BiChat.Message.EditMessage')}
          className="cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-colors p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          aria-label={t('BiChat.Message.EditMessage')}
        >
          <PencilSimple size={16} className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default memo(MessageActions)
export { MessageActions }
export type { ActionableMessage }
