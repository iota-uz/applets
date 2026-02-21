/**
 * SourcesPanel component
 * Grok-inspired collapsible citations panel.
 * Collapsed: compact pill with overlapping domain circles + count.
 * Expanded: card panel with source titles, excerpts, and domain badges.
 */

import { useState, useCallback } from 'react'
import { X } from '@phosphor-icons/react'
import type { Citation } from '../types'
import { useTranslation } from '../hooks/useTranslation'

interface SourcesPanelProps {
  citations: Citation[]
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const PALETTE = [
  '#c0392b', '#d35400', '#f39c12', '#27ae60',
  '#16a085', '#2980b9', '#8e44ad', '#d63384',
]

function domainColor(domain: string): string {
  let h = 0
  for (let i = 0; i < domain.length; i++) h = domain.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function SourcesPanel({ citations }: SourcesPanelProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  if (!citations?.length) return null

  const domains = [...new Set(
    citations.filter(c => c.url).map(c => extractDomain(c.url)).filter(Boolean),
  )]
  const previewDomains = domains.slice(0, 5)

  /* ── Collapsed pill ─────────────────────────────────────────────────── */
  if (!isOpen) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={open}
          className="cursor-pointer inline-flex items-center gap-2 rounded-full px-3 py-1.5
            bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-600/60
            border border-gray-200/70 dark:border-gray-600/40
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bichat-primary,theme(colors.blue.500))]/40"
        >
          {previewDomains.length > 0 && (
            <span className="flex -space-x-1.5">
              {previewDomains.map((domain, i) => (
                <span
                  key={domain}
                  className="relative w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white
                    ring-2 ring-white dark:ring-gray-800 select-none"
                  style={{ backgroundColor: domainColor(domain), zIndex: previewDomains.length - i }}
                  aria-hidden="true"
                >
                  {domain[0]?.toUpperCase()}
                </span>
              ))}
            </span>
          )}
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
            {citations.length} {citations.length === 1 ? 'source' : 'sources'}
          </span>
        </button>
      </div>
    )
  }

  /* ── Expanded panel ─────────────────────────────────────────────────── */
  return (
    <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Sources
        </span>
        <button
          type="button"
          onClick={close}
          className="cursor-pointer flex items-center justify-center w-7 h-7 rounded-full
            text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-700
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bichat-primary)]/40"
          aria-label={t('BiChat.Image.Close')}
        >
          <X size={14} weight="bold" />
        </button>
      </div>

      {/* Source list */}
      <div className="max-h-80 overflow-y-auto">
        {citations.map((citation, index) => {
          const domain = citation.url ? extractDomain(citation.url) : ''

          const cardContent = (
            <>
              <h4 className="text-sm font-medium leading-snug text-[var(--bichat-color-accent,theme(colors.blue.600))] dark:text-blue-400">
                {citation.title || `Source ${index + 1}`}
              </h4>
              {citation.excerpt && (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                  {citation.excerpt}
                </p>
              )}
              {domain && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0 select-none"
                    style={{ backgroundColor: domainColor(domain) }}
                    aria-hidden="true"
                  >
                    {domain[0]?.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                    {domain}
                  </span>
                </div>
              )}
            </>
          )

          const cardClass = 'block px-4 py-3 border-t border-gray-100 dark:border-gray-700/50'

          if (citation.url) {
            return (
              <a
                key={citation.id}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${cardClass} hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors duration-100
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--bichat-primary)]/40`}
              >
                {cardContent}
              </a>
            )
          }

          return (
            <div key={citation.id} className={cardClass}>
              {cardContent}
            </div>
          )
        })}
      </div>
    </div>
  )
}
