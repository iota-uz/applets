/**
 * ActivityTrace — ephemeral activity indicator during AI streaming.
 *
 * Replaces the generic TypingIndicator with a rich, animated trace showing:
 * - Thinking/reasoning content from the model
 * - Tool execution steps with localized labels
 * - Sub-agent delegation with nested child steps
 *
 * All content is ephemeral — it disappears when the final answer arrives.
 */

import { memo, useMemo } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import type { ActivityStep } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import { getToolLabel } from '../utils/toolLabels'
import { groupSteps } from '../utils/activitySteps'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActivityTraceProps {
  thinkingContent: string
  activeSteps: ActivityStep[]
  /** Consumer tool label prefix (e.g. 'Ali.Tools') for custom tool translations. */
  toolLabelPrefix?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function ActivityTraceInner({
  thinkingContent,
  activeSteps,
  toolLabelPrefix,
  className = '',
}: ActivityTraceProps) {
  const { t } = useTranslation()

  // Hooks must be called unconditionally (React rules of hooks)
  const { topLevel, agentGroups } = useMemo(() => groupSteps(activeSteps), [activeSteps])

  const hasContent = thinkingContent || activeSteps.length > 0
  if (!hasContent) return null

  return (
    <MotionConfig reducedMotion="user">
      <div
        role="status"
        aria-live="polite"
        className={`flex gap-3 ${className}`}
      >
        {/* AI avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium text-xs">
          AI
        </div>

        {/* Trace content */}
        <div className="flex-1 max-w-[85%] space-y-2">
          {/* Thinking bubble */}
          <AnimatePresence>
            {thinkingContent && (
              <motion.div
                key="thinking-bubble"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <ThinkingBubble content={thinkingContent} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Activity steps */}
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {topLevel.map((step) => (
                <StepItem
                  key={step.id}
                  step={step}
                  t={t}
                  toolLabelPrefix={toolLabelPrefix}
                />
              ))}
            </AnimatePresence>

            {/* Agent groups (sub-agent tool calls) */}
            <AnimatePresence initial={false}>
              {agentGroups.map(([agentName, steps]) => (
                <AgentGroup
                  key={agentName}
                  agentName={agentName}
                  steps={steps}
                  t={t}
                  toolLabelPrefix={toolLabelPrefix}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}

// ---------------------------------------------------------------------------
// ThinkingBubble
// ---------------------------------------------------------------------------

function ThinkingBubble({ content }: { content: string }) {
  // Show last 2 lines of thinking, truncated
  const truncated = useMemo(() => {
    const lines = content.trim().split('\n')
    const last = lines.slice(-2).join('\n')
    return last.length > 200 ? last.slice(-200) + '...' : last
  }, [content])

  return (
    <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
      <span className="inline-block w-2 h-2 mt-1.5 rounded-full bg-primary-400 animate-pulse shrink-0" />
      <div className="min-w-0 overflow-hidden">
        <span className="font-medium bichat-thinking-shimmer">
          {truncated}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StepItem
// ---------------------------------------------------------------------------

interface StepItemProps {
  step: ActivityStep
  t: (key: string, params?: Record<string, string | number | boolean>) => string
  toolLabelPrefix?: string
}

function StepItem({ step, t, toolLabelPrefix }: StepItemProps) {
  const label = useMemo(
    () =>
      step.type === 'thinking'
        ? t('BiChat.Thinking.Thinking')
        : getToolLabel(t, step.toolName, step.arguments, toolLabelPrefix),
    [step.type, step.toolName, step.arguments, t, toolLabelPrefix]
  )

  const isCompleted = step.status === 'completed'
  const duration = step.durationMs != null
    ? step.durationMs < 1000
      ? `${step.durationMs}ms`
      : `${(step.durationMs / 1000).toFixed(1)}s`
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={`flex items-center gap-2 text-sm transition-colors duration-200 ${
        isCompleted
          ? 'text-gray-400 dark:text-gray-500'
          : 'text-gray-600 dark:text-gray-300'
      }`}
      aria-label={`${label}, ${isCompleted ? 'completed' : 'in progress'}`}
    >
      <StatusIndicator completed={isCompleted} />
      <span className={isCompleted ? '' : 'font-medium'}>{label}</span>
      {duration && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-gray-400 dark:text-gray-500 tabular-nums"
        >
          {duration}
        </motion.span>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// AgentGroup
// ---------------------------------------------------------------------------

interface AgentGroupProps {
  agentName: string
  steps: ActivityStep[]
  t: (key: string, params?: Record<string, string | number | boolean>) => string
  toolLabelPrefix?: string
}

function AgentGroup({ agentName, steps, t, toolLabelPrefix }: AgentGroupProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="ml-4 pl-3 border-l-2 border-primary-200 dark:border-primary-800 space-y-1"
    >
      <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
        {agentName}
      </span>
      <AnimatePresence initial={false}>
        {steps.map((step) => (
          <StepItem key={step.id} step={step} t={t} toolLabelPrefix={toolLabelPrefix} />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// StatusIndicator
// ---------------------------------------------------------------------------

function StatusIndicator({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <motion.svg
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className="w-3.5 h-3.5 text-green-500 dark:text-green-400 shrink-0"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          d="M3 8.5L6.5 12L13 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    )
  }

  return (
    <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-50 motion-reduce:animate-none" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const ActivityTrace = memo(ActivityTraceInner)
ActivityTrace.displayName = 'ActivityTrace'
