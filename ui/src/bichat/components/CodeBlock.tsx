/**
 * CodeBlock Component
 * Syntax highlighted code blocks with copy functionality and dark mode support
 */

import { useState, useEffect, useRef, useSyncExternalStore, memo } from 'react'
import { Copy, Check } from '@phosphor-icons/react'
import { useTranslation } from '../hooks/useTranslation'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  /** Programming language for syntax highlighting */
  language: string
  /** Code content to display */
  value: string
  /** Whether to render as inline code */
  inline?: boolean
  /** Copy button label (defaults to "Copy") */
  copyLabel?: string
  /** Copied confirmation label (defaults to "Copied!") */
  copiedLabel?: string
}

// Module-level singleton dark mode detection — shared across all CodeBlock instances
const darkModeStore = (() => {
  let current = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const listeners = new Set<() => void>()

  function check() {
    const next =
      typeof document !== 'undefined' &&
      (document.documentElement.classList.contains('dark') ||
        (!document.documentElement.classList.contains('light') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches))
    if (next !== current) {
      current = next
      listeners.forEach((fn) => fn())
    }
  }

  if (typeof document !== 'undefined') {
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', check)
  }

  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    getSnapshot: () => current,
    getServerSnapshot: () => false,
  }
})()

function useDarkMode() {
  return useSyncExternalStore(darkModeStore.subscribe, darkModeStore.getSnapshot, darkModeStore.getServerSnapshot)
}

// Language aliases for normalization
const languageMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  py: 'python',
  rb: 'ruby',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  json: 'json',
  xml: 'xml',
  html: 'html',
  css: 'css',
  sql: 'sql',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  php: 'php',
}

function normalizeLanguage(lang: string): string {
  if (!lang) return 'text'
  return languageMap[lang.toLowerCase()] || lang.toLowerCase()
}

function CodeBlock({
  language,
  value,
  inline,
  copyLabel,
  copiedLabel,
}: CodeBlockProps) {
  const { t } = useTranslation()
  const resolvedCopyLabel = copyLabel ?? t('BiChat.Message.Copy')
  const resolvedCopiedLabel = copiedLabel ?? t('BiChat.Message.Copied')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const isDarkMode = useDarkMode()
  const copyTimeoutRef = useRef<number | null>(null)
  const copyFailedTimeoutRef = useRef<number | null>(null)

  const normalizedLanguage = normalizeLanguage(language)

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current)
      }
      if (copyFailedTimeoutRef.current !== null) {
        clearTimeout(copyFailedTimeoutRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setCopyFailed(false)
      // Clear any existing timeout before setting a new one
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        copyTimeoutRef.current = null
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      setCopyFailed(true)
      if (copyFailedTimeoutRef.current !== null) {
        clearTimeout(copyFailedTimeoutRef.current)
      }
      copyFailedTimeoutRef.current = window.setTimeout(() => {
        setCopyFailed(false)
        copyFailedTimeoutRef.current = null
      }, 2000)
    }
  }

  // Inline code styling
  if (inline) {
    return (
      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded text-sm font-mono">
        {value}
      </code>
    )
  }

  // Code block with syntax highlighting
  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
      {/* Language label and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase">
          {normalizedLanguage}
        </span>
        <button
          onClick={handleCopy}
          className={`text-xs transition-colors flex items-center gap-1.5 ${
            copyFailed
              ? 'text-red-500 dark:text-red-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
          title={resolvedCopyLabel}
          aria-live="polite"
        >
          {copied ? (
            <>
              <Check size={16} className="w-4 h-4" />
              <span>{resolvedCopiedLabel}</span>
            </>
          ) : (
            <>
              <Copy size={16} className="w-4 h-4" />
              <span>{copyFailed ? t('BiChat.Message.CopyFailed') : resolvedCopyLabel}</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <SyntaxHighlighter
        language={normalizedLanguage}
        style={isDarkMode ? vscDarkPlus : vs}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.875rem',
          lineHeight: '1.5',
          padding: '1rem',
        }}
        showLineNumbers={false}
        wrapLines={true}
        codeTagProps={{
          style: {
            fontFamily: '"JetBrains Mono", "Fira Code", "Menlo", monospace',
          },
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}

const MemoizedCodeBlock = memo(CodeBlock)
MemoizedCodeBlock.displayName = 'CodeBlock'

export { MemoizedCodeBlock as CodeBlock }
export default MemoizedCodeBlock
