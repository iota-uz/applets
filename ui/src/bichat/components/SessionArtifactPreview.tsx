import { useEffect, useMemo, useState } from 'react'
import { ArrowSquareOut, DownloadSimple, FileText, SpinnerGap, WarningCircle } from '@phosphor-icons/react'
import type { SessionArtifact } from '../types'
import { parseChartDataFromSpec, isRecord } from '../utils/chartSpec'
import { parseRenderTableDataFromMetadata } from '../utils/tableSpec'
import { ChartCard } from './ChartCard'
import { InteractiveTableCard } from './InteractiveTableCard'
import { useTranslation } from '../hooks/useTranslation'
import {
  getArtifactName,
  isImageArtifact,
  isPDFArtifact,
  isOfficeDocumentArtifact,
  isTextArtifact,
} from '../utils/artifactHelpers'

interface SessionArtifactPreviewProps {
  artifact: SessionArtifact
}

const TEXT_PREVIEW_MAX_CHARS = 24000

function parseChartDataFromArtifact(artifact: SessionArtifact) {
  const metadata = artifact.metadata
  if (!metadata || !isRecord(metadata)) {
    return null
  }

  const spec = isRecord(metadata.spec) ? metadata.spec : metadata
  if (!isRecord(spec)) {
    return null
  }

  return parseChartDataFromSpec(spec, getArtifactName(artifact))
}

function isAbsoluteHTTPURL(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function WarningBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200">
      <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" weight="duotone" />
      <span className="leading-relaxed">{message}</span>
    </div>
  )
}

function ArtifactActions({ url }: { url: string }) {
  const { t } = useTranslation()
  const openLabel = t('BiChat.Artifacts.OpenInNewTab')
  const downloadLabel = t('BiChat.Artifacts.Download')

  return (
    <div className="flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <ArrowSquareOut className="h-3.5 w-3.5" weight="bold" />
        {openLabel}
      </a>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        download
        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
      >
        <DownloadSimple className="h-3.5 w-3.5" weight="bold" />
        {downloadLabel}
      </a>
    </div>
  )
}

function TextArtifactPreview({ artifact }: { artifact: SessionArtifact }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    if (!artifact.url) {
      setLoading(false)
      setError(t('BiChat.Artifacts.TextPreviewFailed'))
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setContent('')
    setTruncated(false)

    fetch(artifact.url, { signal: controller.signal, credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const text = await response.text()
        if (text.length > TEXT_PREVIEW_MAX_CHARS) {
          setContent(text.slice(0, TEXT_PREVIEW_MAX_CHARS))
          setTruncated(true)
          return
        }
        setContent(text)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        setError(t('BiChat.Artifacts.TextPreviewFailed'))
      })
      .finally(() => {
        setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [artifact.url, t])

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-800/30 dark:text-gray-400">
        <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
        {t('BiChat.Artifacts.PreviewLoading')}
      </div>
    )
  }

  if (error) {
    return <WarningBox message={error} />
  }

  return (
    <div className="space-y-2">
      <pre className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-100">
        {content || t('BiChat.Artifacts.PreviewUnavailable')}
      </pre>
      {truncated && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('BiChat.Artifacts.TextPreviewTruncated')}</p>
      )}
    </div>
  )
}

export function SessionArtifactPreview({ artifact }: SessionArtifactPreviewProps) {
  const { t } = useTranslation()
  const artifactName = getArtifactName(artifact)

  const officeViewerURL = useMemo(() => {
    if (!artifact.url || !isAbsoluteHTTPURL(artifact.url)) {
      return null
    }
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(artifact.url)}`
  }, [artifact.url])

  if (artifact.type === 'chart') {
    const chartData = parseChartDataFromArtifact(artifact)
    if (chartData) {
      return <ChartCard chartData={chartData} />
    }
    return <WarningBox message={t('BiChat.Artifacts.ChartUnavailable')} />
  }

  if (artifact.type === 'table' && artifact.metadata && typeof artifact.metadata === 'object') {
    const tableData = parseRenderTableDataFromMetadata(
      artifact.metadata as Record<string, unknown>,
      artifact.id
    )
    if (tableData) {
      return (
        <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-700/60 dark:bg-gray-900/30">
          <InteractiveTableCard table={tableData} />
        </div>
      )
    }
    return <WarningBox message={t('BiChat.Artifacts.PreviewUnavailable')} />
  }

  if (isImageArtifact(artifact)) {
    if (!artifact.url) {
      return <WarningBox message={t('BiChat.Artifacts.ImageUnavailable')} />
    }

    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/50 dark:border-gray-700/60 dark:bg-gray-800/30">
          <img
            src={artifact.url}
            alt={artifactName}
            className="h-auto max-h-[72vh] w-full object-contain"
            loading="lazy"
          />
        </div>
        <ArtifactActions url={artifact.url} />
      </div>
    )
  }

  if (isPDFArtifact(artifact)) {
    if (!artifact.url) {
      return <WarningBox message={t('BiChat.Artifacts.DownloadUnavailable')} />
    }

    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-900">
          <iframe
            src={artifact.url}
            title={artifactName}
            className="h-[72vh] w-full"
          />
        </div>
        <ArtifactActions url={artifact.url} />
      </div>
    )
  }

  if (isOfficeDocumentArtifact(artifact)) {
    if (!artifact.url) {
      return <WarningBox message={t('BiChat.Artifacts.DownloadUnavailable')} />
    }

    return (
      <div className="space-y-3">
        {officeViewerURL ? (
          <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-900">
            <iframe
              src={officeViewerURL}
              title={artifactName}
              className="h-[72vh] w-full"
            />
          </div>
        ) : (
          <WarningBox message={t('BiChat.Artifacts.OfficePreviewUnavailable')} />
        )}
        <ArtifactActions url={artifact.url} />
      </div>
    )
  }

  if (isTextArtifact(artifact)) {
    return (
      <div className="space-y-3">
        <TextArtifactPreview artifact={artifact} />
        {artifact.url && <ArtifactActions url={artifact.url} />}
      </div>
    )
  }

  if (artifact.url) {
    return (
      <div className="space-y-3">
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-gray-200/80 bg-gray-50/60 p-6 text-center dark:border-gray-700/60 dark:bg-gray-900">
          <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500" weight="duotone" />
          <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{t('BiChat.Artifacts.PreviewUnavailable')}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('BiChat.Artifacts.PreviewNotSupported')}</p>
        </div>
        <ArtifactActions url={artifact.url} />
      </div>
    )
  }

  return <WarningBox message={t('BiChat.Artifacts.DownloadUnavailable')} />
}
