/**
 * UserMessage Component (Layer 3 Composite)
 * Styled component with slot-based customization for user messages
 */

import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { Check, Copy, PencilSimple } from '@phosphor-icons/react'
import { formatRelativeTime } from '../utils/dateFormatting'
import AttachmentGrid from './AttachmentGrid'
import ImageModal from './ImageModal'
import type { Attachment, ImageAttachment, UserTurn } from '../types'
import { useTranslation } from '../hooks/useTranslation'

/* -------------------------------------------------------------------------------------------------
 * Slot Props Types
 * -----------------------------------------------------------------------------------------------*/

export interface UserMessageAvatarSlotProps {
  /** Default initials */
  initials: string
}

export interface UserMessageContentSlotProps {
  /** Message content text */
  content: string
}

export interface UserMessageAttachmentsSlotProps {
  /** Message attachments */
  attachments: Attachment[]
  /** Handler to open image viewer */
  onView: (index: number) => void
}

export interface UserMessageActionsSlotProps {
  /** Copy content to clipboard */
  onCopy: () => void
  /** Edit message (if available) */
  onEdit?: () => void
  /** Formatted timestamp */
  timestamp: string
  /** Whether copy action is available */
  canCopy: boolean
  /** Whether edit action is available */
  canEdit: boolean
}

/* -------------------------------------------------------------------------------------------------
 * Component Types
 * -----------------------------------------------------------------------------------------------*/

export interface UserMessageSlots {
  /** Custom avatar renderer */
  avatar?: ReactNode | ((props: UserMessageAvatarSlotProps) => ReactNode)
  /** Custom content renderer */
  content?: ReactNode | ((props: UserMessageContentSlotProps) => ReactNode)
  /** Custom attachments renderer */
  attachments?: ReactNode | ((props: UserMessageAttachmentsSlotProps) => ReactNode)
  /** Custom actions renderer */
  actions?: ReactNode | ((props: UserMessageActionsSlotProps) => ReactNode)
}

export interface UserMessageClassNames {
  /** Root container */
  root?: string
  /** Inner content wrapper */
  wrapper?: string
  /** Avatar container */
  avatar?: string
  /** Message bubble */
  bubble?: string
  /** Content text */
  content?: string
  /** Attachments container */
  attachments?: string
  /** Actions container */
  actions?: string
  /** Action button */
  actionButton?: string
  /** Timestamp */
  timestamp?: string
}

export interface UserMessageProps {
  /** User turn data */
  turn: UserTurn
  /** Turn ID for edit operations */
  turnId?: string
  /** User initials for avatar */
  initials?: string
  /** Slot overrides */
  slots?: UserMessageSlots
  /** Class name overrides */
  classNames?: UserMessageClassNames
  /** Copy handler */
  onCopy?: (content: string) => Promise<void> | void
  /** Edit handler */
  onEdit?: (turnId: string, newContent: string) => void
  /** Hide avatar */
  hideAvatar?: boolean
  /** Hide actions */
  hideActions?: boolean
  /** Hide timestamp */
  hideTimestamp?: boolean
  /** Whether edit action should be available */
  allowEdit?: boolean
}

const COPY_FEEDBACK_MS = 2000

/* -------------------------------------------------------------------------------------------------
 * Default Styles
 * -----------------------------------------------------------------------------------------------*/

const defaultClassNames: Required<UserMessageClassNames> = {
  root: 'flex gap-3 justify-end group',
  wrapper: 'flex-1 flex flex-col items-end max-w-[var(--bichat-bubble-max-width)]',
  avatar: 'flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium text-sm',
  bubble: 'bg-primary-600 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm',
  content: 'text-sm whitespace-pre-wrap break-words leading-relaxed',
  attachments: 'mb-2 w-full',
  actions: 'flex items-center gap-1 mt-2 transition-opacity duration-150 group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100',
  actionButton: 'cursor-pointer p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
  timestamp: 'text-xs text-gray-400 dark:text-gray-500 mr-1',
}

function mergeClassNames(
  defaults: Required<UserMessageClassNames>,
  overrides?: UserMessageClassNames
): Required<UserMessageClassNames> {
  if (!overrides) return defaults
  return {
    root: overrides.root ?? defaults.root,
    wrapper: overrides.wrapper ?? defaults.wrapper,
    avatar: overrides.avatar ?? defaults.avatar,
    bubble: overrides.bubble ?? defaults.bubble,
    content: overrides.content ?? defaults.content,
    attachments: overrides.attachments ?? defaults.attachments,
    actions: overrides.actions ?? defaults.actions,
    actionButton: overrides.actionButton ?? defaults.actionButton,
    timestamp: overrides.timestamp ?? defaults.timestamp,
  }
}

/* -------------------------------------------------------------------------------------------------
 * EditForm Sub-component
 * -----------------------------------------------------------------------------------------------*/

interface EditFormProps {
  draftContent: string
  onDraftChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSave: () => void
  onCancel: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  textareaRef: React.Ref<HTMLTextAreaElement>
  disabled: boolean
  originalContent: string
  t: (key: string) => string
}

function EditForm({ draftContent, onDraftChange, onSave, onCancel, onKeyDown, textareaRef, disabled, originalContent, t }: EditFormProps) {
  return (
    <div className="space-y-3">
      <textarea
        ref={textareaRef}
        value={draftContent}
        onChange={onDraftChange}
        onKeyDown={onKeyDown}
        className="w-full min-h-[60px] max-h-[300px] resize-none rounded-xl border border-white/20 bg-white/[0.08] px-3.5 py-2.5 text-sm text-white leading-relaxed outline-none focus:bg-white/[0.12] focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all duration-200"
        aria-label={t('BiChat.Message.EditMessage')}
        rows={1}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-white/30 select-none hidden sm:inline">
          Esc · {typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(
            (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
              ?? navigator?.platform
              ?? ''
          ) ? '⌘' : 'Ctrl'}+Enter
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer px-3 py-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            {t('BiChat.Message.Cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="cursor-pointer px-4 py-1.5 rounded-lg bg-white text-primary-700 font-medium text-sm hover:bg-white/90 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            disabled={disabled || !draftContent.trim() || draftContent === originalContent}
          >
            {t('BiChat.Message.Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Component
 * -----------------------------------------------------------------------------------------------*/

export function UserMessage({
  turn,
  turnId,
  initials = 'U',
  slots,
  classNames: classNameOverrides,
  onCopy,
  onEdit,
  hideAvatar = false,
  hideActions = false,
  hideTimestamp = false,
  allowEdit = true,
}: UserMessageProps) {
  const { t } = useTranslation()
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const classes = mergeClassNames(defaultClassNames, classNameOverrides)

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current)
        copyFeedbackTimeoutRef.current = null
      }
    }
  }, [])

  // Reset edit state when the turn changes
  useEffect(() => {
    setIsEditing(false)
    setDraftContent('')
  }, [turnId])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      const textarea = editTextareaRef.current
      textarea.focus()
      textarea.selectionStart = textarea.value.length
      textarea.selectionEnd = textarea.value.length
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
    }
  }, [isEditing])

  // Click-outside to cancel edit
  useEffect(() => {
    if (!isEditing) return

    const handleMouseDown = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setIsEditing(false)
        setDraftContent('')
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isEditing])

  const normalizedAttachments: Attachment[] = useMemo(
    () =>
      turn.attachments.map((attachment) => {
        if (!attachment.mimeType.startsWith('image/')) {
          return attachment
        }

        if (attachment.preview) {
          return attachment
        }
        if (attachment.base64Data) {
          if (attachment.base64Data.startsWith('data:')) {
            return {
              ...attachment,
              preview: attachment.base64Data,
            }
          }
          return {
            ...attachment,
            preview: `data:${attachment.mimeType};base64,${attachment.base64Data}`,
          }
        }
        if (attachment.url) {
          return {
            ...attachment,
            preview: attachment.url,
          }
        }
        return attachment
      }),
    [turn.attachments],
  )

  const { imageAttachments, imageIndexByAttachmentIndex } = useMemo(() => {
    const images: ImageAttachment[] = []
    const indexMap = new Map<number, number>()
    normalizedAttachments.forEach((attachment, index) => {
      if (!attachment.mimeType.startsWith('image/')) {
        return
      }
      if (!attachment.preview && !attachment.url) {
        return
      }
      indexMap.set(index, images.length)
      images.push({
        ...attachment,
        base64Data: attachment.base64Data || '',
        preview: attachment.preview || attachment.url || '',
      })
    })
    return { imageAttachments: images, imageIndexByAttachmentIndex: indexMap }
  }, [normalizedAttachments])

  const handleCopyClick = useCallback(async () => {
    try {
      if (onCopy) {
        await onCopy(turn.content)
      } else {
        await navigator.clipboard.writeText(turn.content)
      }

      setIsCopied(true)
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current)
      }
      copyFeedbackTimeoutRef.current = setTimeout(() => {
        setIsCopied(false)
        copyFeedbackTimeoutRef.current = null
      }, COPY_FEEDBACK_MS)
    } catch (err) {
      setIsCopied(false)
      console.error('Failed to copy:', err)
    }
  }, [onCopy, turn.content])

  const handleEditClick = useCallback(() => {
    if (onEdit && turnId) {
      setDraftContent(turn.content)
      setIsEditing(true)
    }
  }, [onEdit, turnId, turn.content])

  const handleEditCancel = useCallback(() => {
    setIsEditing(false)
    setDraftContent('')
  }, [])

  const handleEditSave = useCallback(() => {
    if (!onEdit || !turnId) return
    const newContent = draftContent
    if (!newContent.trim()) return
    if (newContent === turn.content) {
      setIsEditing(false)
      return
    }
    onEdit(turnId, newContent)
    setIsEditing(false)
  }, [onEdit, turnId, draftContent, turn.content])

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleEditCancel()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleEditSave()
    }
  }, [handleEditCancel, handleEditSave])

  const handleDraftChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`
  }, [])

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (selectedImageIndex === null) return

      if (direction === 'prev' && selectedImageIndex > 0) {
        setSelectedImageIndex(selectedImageIndex - 1)
      } else if (direction === 'next' && selectedImageIndex < imageAttachments.length - 1) {
        setSelectedImageIndex(selectedImageIndex + 1)
      }
    },
    [selectedImageIndex, imageAttachments.length]
  )

  const currentAttachment =
    selectedImageIndex !== null ? imageAttachments[selectedImageIndex] : null

  const timestamp = formatRelativeTime(turn.createdAt, t)

  // Slot props
  const avatarSlotProps: UserMessageAvatarSlotProps = { initials }
  const contentSlotProps: UserMessageContentSlotProps = { content: turn.content }
  const attachmentsSlotProps: UserMessageAttachmentsSlotProps = {
    attachments: normalizedAttachments,
    onView: (index) => {
      const imageIndex = imageIndexByAttachmentIndex.get(index)
      if (imageIndex === undefined) {
        return
      }
      setSelectedImageIndex(imageIndex)
    },
  }
  const actionsSlotProps: UserMessageActionsSlotProps = {
    onCopy: handleCopyClick,
    onEdit: onEdit && turnId && allowEdit ? handleEditClick : undefined,
    timestamp,
    canCopy: true,
    canEdit: !!onEdit && !!turnId && allowEdit,
  }

  // Render helpers
  const renderSlot = <T,>(
    slot: ReactNode | ((props: T) => ReactNode) | undefined,
    props: T,
    defaultContent: ReactNode
  ): ReactNode => {
    if (slot === undefined) return defaultContent
    if (typeof slot === 'function') return slot(props)
    return slot
  }

  return (
    <div className={classes.root}>
      <div className={classes.wrapper}>
        {/* Attachments */}
        {normalizedAttachments.length > 0 && (
          <div className={classes.attachments}>
            {renderSlot(
              slots?.attachments,
              attachmentsSlotProps,
              <AttachmentGrid
                attachments={normalizedAttachments}
                onView={attachmentsSlotProps.onView}
              />
            )}
          </div>
        )}

        {/* Message bubble */}
        {turn.content && (
          <div ref={bubbleRef} className={classes.bubble}>
            <div className={classes.content}>
              {isEditing ? (
                <EditForm
                  draftContent={draftContent}
                  onDraftChange={handleDraftChange}
                  onSave={handleEditSave}
                  onCancel={handleEditCancel}
                  onKeyDown={handleEditKeyDown}
                  textareaRef={editTextareaRef}
                  disabled={false}
                  originalContent={turn.content}
                  t={t}
                />
              ) : (
                renderSlot(slots?.content, contentSlotProps, turn.content)
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!hideActions && (
          <div className={`${classes.actions} ${isCopied ? 'opacity-100' : ''}`}>
            {renderSlot(
              slots?.actions,
              actionsSlotProps,
              <>
                {!hideTimestamp && <span className={classes.timestamp}>{timestamp}</span>}

                <button
                  onClick={handleCopyClick}
                  className={`cursor-pointer ${classes.actionButton} ${isCopied ? 'text-green-600 dark:text-green-400' : ''}`}
                  aria-label={t('BiChat.Message.CopyMessage')}
                  title={isCopied ? t('BiChat.Message.Copied') : t('BiChat.Message.Copy')}
                  data-copied={isCopied ? 'true' : undefined}
                >
                  {isCopied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="regular" />}
                </button>

                {onEdit && turnId && allowEdit && (
                  <button
                    onClick={handleEditClick}
                    className={`cursor-pointer ${classes.actionButton}`}
                    aria-label={t('BiChat.Message.EditMessage')}
                    title={t('BiChat.Message.EditMessage')}
                    disabled={isEditing}
                  >
                    <PencilSimple size={14} weight="regular" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Avatar */}
      {!hideAvatar && (
        <div className={classes.avatar}>
          {renderSlot(slots?.avatar, avatarSlotProps, initials)}
        </div>
      )}

      {/* Image modal */}
      {currentAttachment && (
        <ImageModal
          isOpen={selectedImageIndex !== null}
          onClose={() => setSelectedImageIndex(null)}
          attachment={currentAttachment}
          allAttachments={imageAttachments}
          currentIndex={selectedImageIndex ?? 0}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  )
}

export default UserMessage
