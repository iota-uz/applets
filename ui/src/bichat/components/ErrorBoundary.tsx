/**
 * ErrorBoundary Component
 * React error boundary for catching and displaying errors gracefully
 */

import { Component, ErrorInfo, ReactNode } from 'react'
import { WarningCircle, ArrowClockwise } from '@phosphor-icons/react'
import { useTranslation } from '../hooks/useTranslation'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional custom error UI */
  fallback?: ReactNode | ((error: Error | null, reset: () => void) => ReactNode)
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Default error UI component
 */
function DefaultErrorContent({
  error,
  onReset,
  resetLabel,
  errorTitle,
}: {
  error: Error | null
  onReset?: () => void
  resetLabel?: string
  errorTitle?: string
}) {
  const { t } = useTranslation()
  const resolvedResetLabel = resetLabel ?? t('BiChat.Common.TryAgain')
  const resolvedErrorTitle = errorTitle ?? t('BiChat.Error.SomethingWentWrong')
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03] dark:opacity-[0.04]" aria-hidden="true">
        <svg className="absolute -top-8 -right-8 w-64 h-64 text-red-500" viewBox="0 0 200 200" fill="currentColor">
          <circle cx="100" cy="100" r="80" opacity="0.5" />
          <circle cx="100" cy="100" r="50" opacity="0.3" />
          <circle cx="100" cy="100" r="25" opacity="0.2" />
        </svg>
      </div>

      <div className="relative flex flex-col items-center">
        {/* Icon with soft glow ring */}
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-full bg-red-100 dark:bg-red-900/30 scale-150 blur-md" />
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40">
            <WarningCircle size={28} className="text-red-500 dark:text-red-400" weight="fill" />
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1.5">{resolvedErrorTitle}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-md leading-relaxed">
          {error?.message || t('BiChat.Error.UnexpectedError')}
        </p>

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg transition-colors shadow-sm text-sm font-medium"
          >
            <ArrowClockwise size={16} weight="bold" />
            {resolvedResetLabel}
          </button>
        )}
      </div>
    </div>
  )
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.handleReset)
        }
        return this.props.fallback
      }

      // Default error UI
      return <DefaultErrorContent error={this.state.error} onReset={this.handleReset} />
    }

    return this.props.children
  }
}

export default ErrorBoundary
export { ErrorBoundary, DefaultErrorContent }
