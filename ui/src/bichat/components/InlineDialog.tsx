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

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function InlineDialog({ open, onClose, className, children }: InlineDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const getFocusable = (): HTMLElement[] =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') {
        return;
      }
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    (getFocusable()[0] ?? container)?.focus();
    container.addEventListener('keydown', handler as EventListener);
    return () => {
      container.removeEventListener('keydown', handler as EventListener);
      previousFocusRef.current?.focus();
    };
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
