/**
 * ToastContainer Component
 * Container for rendering toast notifications.
 * Positioned at bottom-right to stay out of the way of primary content.
 */

import { Toast } from './Toast';
import type { ToastItem } from '../hooks/useToast';
import { useTranslation } from '../hooks/useTranslation';

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
  /** Label for dismiss buttons */
  dismissLabel?: string
}

export function ToastContainer({ toasts, onDismiss, dismissLabel }: ToastContainerProps) {
  const { t } = useTranslation();
  if (toasts.length === 0) {return null;}

  return (
    <div
      aria-label={t('BiChat.Common.Notifications')}
      className="fixed top-6 right-6 z-[var(--bichat-z-toast,60)] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onDismiss={onDismiss} dismissLabel={dismissLabel} />
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
