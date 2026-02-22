/**
 * MessageQueueList Component
 * Shows stacked queued messages above the input with remove/edit capabilities
 */

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, PencilSimple, Check, ArrowCounterClockwise } from '@phosphor-icons/react';
import type { QueuedMessage } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface MessageQueueListProps {
  queue: QueuedMessage[]
  onRemove: (index: number) => void
  onUpdate: (index: number, content: string) => void
}

export function MessageQueueList({ queue, onRemove, onUpdate }: MessageQueueListProps) {
  const { t } = useTranslation();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setEditValue(queue[index].content);
  }, [queue]);

  const saveEdit = useCallback(() => {
    if (editingIndex === null) {return;}
    const trimmed = editValue.trim();
    if (trimmed) {
      onUpdate(editingIndex, trimmed);
    }
    setEditingIndex(null);
    setEditValue('');
  }, [editingIndex, editValue, onUpdate]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditValue('');
  }, []);

  if (queue.length === 0) {return null;}

  return (
    <div className="mb-3 space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium">{t('BiChat.Input.QueuedMessages', { count: queue.length })}</span>
      </div>
      <AnimatePresence initial={false}>
        {queue.map((item, index) => (
          <motion.div
            key={`queue-${index}-${item.content.slice(0, 20)}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-sm">
              <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-[10px] font-bold">
                {index + 1}
              </span>
              {editingIndex === index ? (
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                      if (e.key === 'Escape') {cancelEdit();}
                    }}
                    className="w-full resize-none rounded border border-primary-300 dark:border-primary-600 bg-transparent px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                    rows={1}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded transition-colors"
                    >
                      <Check size={12} weight="bold" />
                      {t('BiChat.Message.Save')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <ArrowCounterClockwise size={12} />
                      {t('BiChat.Message.Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="flex-1 min-w-0 text-gray-700 dark:text-gray-300 truncate">
                  {item.content}
                  {item.attachments.length > 0 && (
                    <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                      +{item.attachments.length} {t('BiChat.Input.AttachFiles').toLowerCase()}
                    </span>
                  )}
                </p>
              )}
              {editingIndex !== index && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(index)}
                    className="cursor-pointer p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label={t('BiChat.Input.EditQueueItem')}
                    title={t('BiChat.Input.EditQueueItem')}
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="cursor-pointer p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    aria-label={t('BiChat.Input.RemoveQueueItem')}
                    title={t('BiChat.Input.RemoveQueueItem')}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
