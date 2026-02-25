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
  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <DialogContext.Provider value={onClose}>
      {/* onClick closes dialog when clicking outside the Panel (Panel stops propagation) */}
      <div className={className} onClick={onClose}>
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const target =
      ref.current.querySelector<HTMLElement>('[data-autofocus]') ??
      ref.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
    target?.focus();
  }, []);

  return (
    <div
      ref={ref}
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
