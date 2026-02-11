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
      <WarningCircle size={48} className="text-red-500 mb-4" weight="fill" />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{resolvedErrorTitle}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md">
        {error?.message || t('BiChat.Error.UnexpectedError')}
      </p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <ArrowClockwise size={16} weight="bold" />
          {resolvedResetLabel}
        </button>
      )}
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
