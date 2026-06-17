/**
 * InlineDialog — portal-free dialog components for Shadow DOM environments.
 *
 * Headless UI Dialog forcibly portals to document.body, escaping Shadow DOM
 * and losing all scoped styles. These components render inline so they stay
 * inside the shadow root and inherit its CSS.
 *
 * API mirrors Headless UI Dialog for minimal migration effort.
 */

import {
  createContext,
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalLock } from '../hooks/useModalLock';

// ---------------------------------------------------------------------------
// Context — passes onClose from InlineDialog to descendants
// ---------------------------------------------------------------------------

const DialogContext = createContext<(() => void) | null>(null);

// ---------------------------------------------------------------------------
// InlineDialog
// ---------------------------------------------------------------------------

interface InlineDialogProps {
  open: boolean
  onClose: () => void
  className?: string
  children: ReactNode
}

export function InlineDialog({ open, onClose, className, children }: InlineDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Lock background scroll + trap/restore focus. useFocusTrap resolves the
  // focused element across the shadow boundary (document.activeElement collapses
  // to the host here), so the trap actually holds inside BiChat's shadow DOM.
  useModalLock(open);
  useFocusTrap(containerRef, open);

  // Escape closes the dialog. Listening on the container keeps it scoped to this
  // dialog (focus is trapped inside) and avoids global key collisions.
  useEffect(() => {
    if (!open) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    container.addEventListener('keydown', handler as EventListener);
    return () => container.removeEventListener('keydown', handler as EventListener);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <DialogContext.Provider value={onClose}>
      {/* onClick closes dialog when clicking outside the Panel (Panel stops propagation) */}
      <div
        ref={containerRef}
        className={className}
        onClick={onClose}
        tabIndex={-1}
      >
        {children}
      </div>
    </DialogContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// InlineDialogBackdrop — purely visual overlay
// ---------------------------------------------------------------------------

export function InlineDialogBackdrop(props: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" {...props} />;
}

// ---------------------------------------------------------------------------
// InlineDialogPanel — auto-focus + stops click propagation
// ---------------------------------------------------------------------------

export function InlineDialogPanel({
  children,
  onClick,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  // Initial focus (including [data-autofocus]) is owned by InlineDialog's
  // useFocusTrap, so the panel no longer self-focuses — that previously stole
  // focus before the trap could record the trigger to restore to on close.
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineDialogTitle / InlineDialogDescription — semantic wrappers
// ---------------------------------------------------------------------------

export function InlineDialogTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} />;
}

export function InlineDialogDescription(props: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} />;
}
