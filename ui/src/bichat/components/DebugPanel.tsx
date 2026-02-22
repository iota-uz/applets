/**
 * DebugPanel Component
 * Debug trace viewer with metric chips, expandable tool calls,
 * and terminal-inspired code blocks.
 *
 * Debug UI is English-only (developer-facing) — no i18n.
 */

import { useState, useRef, useEffect, type ReactNode } from 'react'
import {
  Bug,
  Timer,
  Lightning,
  Wrench,
  CaretDown,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  CircleNotch,
  ArrowUp,
  ArrowDown,
  Stack,
  Database,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import type { DebugTrace, StreamToolPayload } from '../types'
import { hasMeaningfulUsage, hasDebugTrace } from '../utils/debugTrace'
import {
  calculateCompletionTokensPerSecond,
  calculateContextUsagePercent,
  formatDuration,
  formatGenerationDuration,
} from '../utils/debugMetrics'

export interface DebugPanelProps {
  trace?: DebugTrace
  debugLimits?: import('../types').DebugLimits | null
}

// ─── CopyPill ───────────────────────────────────────────────

function CopyPill({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
  }, [])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        setCopied(false)
        timerRef.current = null
      }, 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={[
        'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium',
        'transition-all duration-200',
        copied
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50',
      ].join(' ')}
    >
      {copied ? <Check size={10} weight="bold" /> : <Copy size={10} />}
      <span>{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  )
}

// ─── MetricChip ─────────────────────────────────────────────

interface MetricChipProps {
  icon: ReactNode
  value: string
  label: string
}

function MetricChip({ icon, value, label }: MetricChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-800/40 text-[11px] tabular-nums">
      {icon}
      <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{value}</span>
      <span className="text-gray-400 dark:text-gray-500">{label}</span>
    </span>
  )
}

// ─── ToolCard ───────────────────────────────────────────────

function ToolCard({ tool }: { tool: StreamToolPayload }) {
  const [expanded, setExpanded] = useState(false)

  const hasResult = !!tool.result && !tool.error
  const hasError = !!tool.error

  const status = hasError
    ? {
        icon: <XCircle size={12} weight="fill" />,
        pillBg: 'bg-red-50 dark:bg-red-950/30',
        pillText: 'text-red-500 dark:text-red-400',
        borderColor: 'border-l-red-400 dark:border-l-red-500',
      }
    : hasResult
    ? {
        icon: <CheckCircle size={12} weight="fill" />,
        pillBg: 'bg-emerald-50 dark:bg-emerald-950/30',
        pillText: 'text-emerald-500 dark:text-emerald-400',
        borderColor: 'border-l-emerald-400 dark:border-l-emerald-500',
      }
    : {
        icon: <CircleNotch size={12} weight="bold" className="animate-spin" />,
        pillBg: 'bg-gray-100 dark:bg-gray-800',
        pillText: 'text-gray-400 dark:text-gray-500',
        borderColor: 'border-l-gray-300 dark:border-l-gray-600',
      }

  return (
    <div
      className={[
        'rounded-lg overflow-hidden',
        'border border-gray-200/60 dark:border-gray-700/40',
        'border-l-2', status.borderColor,
        'bg-white dark:bg-gray-800/50',
        'transition-all duration-150',
      ].join(' ')}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${tool.name} — ${hasError ? 'error' : hasResult ? 'success' : 'pending'}`}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50/60 dark:hover:bg-gray-700/20 transition-colors cursor-pointer"
      >
        {/* Status pill */}
        <span className={`flex items-center justify-center w-5 h-5 rounded-full ${status.pillBg} ${status.pillText}`}>
          {status.icon}
        </span>

        {/* Tool name */}
        <span className="flex-1 min-w-0 text-left font-mono text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
          {tool.name}
        </span>

        {/* Duration chip */}
        {tool.durationMs !== undefined && (
          <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700/60 text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 tabular-nums">
            {formatDuration(tool.durationMs)}
          </span>
        )}

        {/* Chevron */}
        <CaretDown
          size={12}
          weight="bold"
          className={[
            'flex-shrink-0 text-gray-300 dark:text-gray-600',
            'transition-transform duration-200',
            expanded ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {/* Expandable content — CSS grid animation for smooth height */}
      <div
        className={[
          'grid transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        ].join(' ')}
      >
        <div className="overflow-hidden min-h-0">
          <div className="px-3 pb-3 pt-1 space-y-2">
            {/* Arguments — terminal-style dark code block */}
            {tool.arguments && (
              <div className="rounded-lg bg-[#1a1b26] dark:bg-gray-950 overflow-hidden ring-1 ring-gray-800/10 dark:ring-white/5">
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1f2e] dark:bg-gray-900/80 border-b border-white/5">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">
                    Arguments
                  </span>
                  <CopyPill text={tool.arguments} />
                </div>
                <pre className="p-3 text-[11px] font-mono text-gray-300 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                  {tool.arguments}
                </pre>
              </div>
            )}

            {/* Result — terminal-style dark code block */}
            {tool.result && (
              <div className="rounded-lg bg-[#1a1b26] dark:bg-gray-950 overflow-hidden ring-1 ring-gray-800/10 dark:ring-white/5">
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1f2e] dark:bg-gray-900/80 border-b border-white/5">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">
                    Result
                  </span>
                  <CopyPill text={tool.result} />
                </div>
                <pre className="p-3 text-[11px] font-mono text-gray-300 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                  {tool.result}
                </pre>
              </div>
            )}

            {/* Error — red-tinted dark block */}
            {tool.error && (
              <div className="rounded-lg bg-red-950/80 dark:bg-red-950/40 overflow-hidden ring-1 ring-red-800/20">
                <div className="px-3 py-1.5 border-b border-red-800/20">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-red-400">
                    Error
                  </span>
                </div>
                <pre className="p-3 text-[11px] font-mono text-red-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {tool.error}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DebugPanel ─────────────────────────────────────────────

export function DebugPanel({ trace, debugLimits = null }: DebugPanelProps) {
  const hasData = !!trace && hasDebugTrace(trace)
  const traceID = trace?.traceId?.trim() || ''
  const traceURL = trace?.traceUrl?.trim() || ''
  const safeTraceURL = (() => {
    if (!traceURL) return ''
    try {
      const parsed = new URL(traceURL)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
      return parsed.toString()
    } catch {
      return ''
    }
  })()

  const tokensPerSecond = calculateCompletionTokensPerSecond(trace?.usage, trace?.generationMs)
  const effectiveMaxTokens = debugLimits?.effectiveMaxTokens ?? 0
  const promptTokens = trace?.usage?.promptTokens ?? 0
  const contextUsagePercent = calculateContextUsagePercent(promptTokens, effectiveMaxTokens)
  const contextUsagePercentLabel = contextUsagePercent !== null ? contextUsagePercent.toFixed(1) : null

  const formatCompactTokens = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '0 tokens'
    return `${new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: value >= 100_000 ? 0 : 1,
    }).format(value)} tokens`
  }

  const contextPercentValue = contextUsagePercent ?? 0
  const contextUsageToneClass =
    contextPercentValue > 75
      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
      : contextPercentValue > 50
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'

  const contextUsageBarColor =
    contextPercentValue > 75
      ? '#ef4444'
      : contextPercentValue > 50
      ? '#f59e0b'
      : '#10b981'

  // Build metric list from available data
  const metrics: MetricChipProps[] = []

  if (hasData && trace) {
    if (trace.generationMs !== undefined) {
      metrics.push({
        icon: <Timer size={12} weight="duotone" className="text-amber-500 dark:text-amber-400" />,
        value: formatGenerationDuration(trace.generationMs),
        label: 'generation',
      })
    }
    if (tokensPerSecond !== null) {
      metrics.push({
        icon: <Lightning size={12} weight="fill" className="text-orange-500 dark:text-orange-400" />,
        value: `${tokensPerSecond.toFixed(1)}/s`,
        label: 'tok/s',
      })
    }
    if (hasMeaningfulUsage(trace.usage) && trace.usage) {
      metrics.push(
        {
          icon: <Stack size={12} weight="duotone" className="text-violet-500 dark:text-violet-400" />,
          value: trace.usage.totalTokens.toLocaleString(),
          label: 'total',
        },
        {
          icon: <ArrowUp size={12} weight="bold" className="text-blue-500 dark:text-blue-400" />,
          value: trace.usage.promptTokens.toLocaleString(),
          label: 'prompt',
        },
        {
          icon: <ArrowDown size={12} weight="bold" className="text-indigo-500 dark:text-indigo-400" />,
          value: trace.usage.completionTokens.toLocaleString(),
          label: 'completion',
        },
      )
      if (trace.usage.cachedTokens !== undefined && trace.usage.cachedTokens > 0) {
        metrics.push({
          icon: <Database size={12} weight="duotone" className="text-pink-500 dark:text-pink-400" />,
          value: trace.usage.cachedTokens.toLocaleString(),
          label: 'cached',
        })
      }
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800">
            <Bug size={14} weight="duotone" className="text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-[11px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500">
            Debug
          </h3>
        </div>
        {hasData && trace && (
          <CopyPill text={JSON.stringify(trace, null, 2)} />
        )}
      </div>

      {hasData && trace ? (
        <div className="space-y-4">
          {(traceID || safeTraceURL) && (
            <div className="rounded-lg border border-gray-200/60 dark:border-gray-700/40 bg-gray-50/50 dark:bg-gray-800/40 p-3 space-y-2">
              {traceID && (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Trace ID</div>
                    <div className="font-mono text-[11px] text-gray-800 dark:text-gray-200 break-all">
                      {traceID}
                    </div>
                  </div>
                  <CopyPill text={traceID} />
                </div>
              )}
              {safeTraceURL && (
                <a
                  href={safeTraceURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View full trace in Langfuse (opens in new tab)"
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <ArrowSquareOut size={12} weight="bold" />
                  <span>Open in Langfuse</span>
                </a>
              )}
            </div>
          )}

          {(trace.thinking || trace.observationReason || trace.sessionId) && (
            <div className="rounded-lg border border-gray-200/60 dark:border-gray-700/40 bg-gray-50/50 dark:bg-gray-800/40 p-3 space-y-2">
              {trace.sessionId && (
                <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Session: <span className="font-mono normal-case break-all">{trace.sessionId}</span>
                </div>
              )}
              {trace.observationReason && (
                <div className="text-[11px] text-amber-700 dark:text-amber-300">
                  Observation: <span className="font-mono">{trace.observationReason}</span>
                </div>
              )}
              {trace.thinking && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Reasoning</div>
                  <pre className="p-2 rounded bg-gray-100 dark:bg-gray-900 text-[11px] whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">
                    {trace.thinking}
                  </pre>
                </div>
              )}
            </div>
          )}

          {((trace.attempts && trace.attempts.length > 0) ||
            (trace.spans && trace.spans.length > 0) ||
            (trace.events && trace.events.length > 0)) && (
            <div className="rounded-lg border border-gray-200/60 dark:border-gray-700/40 bg-gray-50/50 dark:bg-gray-800/40 p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Trace Graph
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!!trace.attempts?.length && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-[10px] text-gray-700 dark:text-gray-300">
                    attempts: {trace.attempts.length}
                  </span>
                )}
                {!!trace.spans?.length && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-[10px] text-gray-700 dark:text-gray-300">
                    spans: {trace.spans.length}
                  </span>
                )}
                {!!trace.events?.length && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-[10px] text-gray-700 dark:text-gray-300">
                    events: {trace.events.length}
                  </span>
                )}
              </div>
              {trace.attempts?.[trace.attempts.length - 1] && (
                <div className="text-[11px] text-gray-700 dark:text-gray-300">
                  {[
                    trace.attempts[trace.attempts.length - 1].model,
                    trace.attempts[trace.attempts.length - 1].provider,
                    trace.attempts[trace.attempts.length - 1].finishReason,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </div>
              )}
            </div>
          )}

          {/* Metric chips */}
          {metrics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {metrics.map((m, i) => (
                <MetricChip key={i} {...m} />
              ))}
            </div>
          )}

          {/* Tool calls */}
          {trace.tools.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Wrench size={13} weight="duotone" className="text-gray-400 dark:text-gray-500" />
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  Tool Calls
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                  {trace.tools.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {trace.tools.map((tool, idx) => (
                  <ToolCard key={`${tool.callId || tool.name}-${idx}`} tool={tool} />
                ))}
              </div>
            </div>
          )}

          {contextUsagePercentLabel !== null && (
            <div className="rounded-lg border border-gray-200/60 dark:border-gray-700/40 bg-gray-50/50 dark:bg-gray-800/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Context usage
                </span>
                <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
                  {formatCompactTokens(promptTokens)} / {formatCompactTokens(effectiveMaxTokens)}
                </span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${contextUsageToneClass}`}>
                  {contextUsagePercentLabel}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200/80 dark:bg-gray-700/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(contextPercentValue, 100)}%`,
                    backgroundColor: contextUsageBarColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          Debug info unavailable
        </p>
      )}
    </div>
  )
}

export default DebugPanel
