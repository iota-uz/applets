/**
 * Shadow-DOM-safe fullscreen overlay.
 *
 * Headless UI Dialog portals to document.body which escapes the shadow DOM
 * boundary and loses Tailwind styles. This component stays inline within
 * the shadow tree.
 */

import { useEffect, useRef } from 'react'
import { X } from '@phosphor-icons/react'

interface FullscreenOverlayProps {
  title: string
  onClose: () => void
  closeLabel: string
  children: React.ReactNode
}

export function FullscreenOverlay({ title, onClose, closeLabel, children }: FullscreenOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="fixed inset-0" style={{ zIndex: 99999 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute inset-4 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl outline-none dark:border-gray-700 dark:bg-gray-900"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          aria-label={closeLabel}
        >
          <X size={18} weight="bold" />
        </button>
        {children}
      </div>
    </div>
  )
}
