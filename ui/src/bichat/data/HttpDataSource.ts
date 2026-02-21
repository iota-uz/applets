/**
 * Built-in HTTP data source with SSE streaming and AbortController
 * Implements ChatDataSource interface with real HTTP/RPC calls
 *
 * Uses turn-based architecture - fetches ConversationTurns instead of flat messages.
 */

import { AppletRPCException, createAppletRPCClient } from '../../applet-host'
import type { BichatRPC, Session as RPCSession } from './rpc.generated'
import type {
  ChatDataSource,
  Session,
  SessionListResult,
  ConversationTurn,
  Artifact as DownloadArtifact,
  SessionArtifact,
  PendingQuestion,
  Question,
  Attachment,
  StreamChunk,
  QuestionAnswers,
  SendMessageOptions,
  AssistantTurn,
  RenderTableData,
} from '../types'
import { MessageRole } from '../types'
import { parseChartDataFromSpec, parseChartDataFromJsonString, isRecord } from '../utils/chartSpec'
import { validateAttachmentFile, validateFileCount } from '../utils/fileUtils'
import { parseBichatStream } from '../utils/sseParser'
import { parseRenderTableDataFromJsonString } from '../utils/tableSpec'
import type { PendingQuestion as RPCPendingQuestion } from './rpc.generated'

export interface HttpDataSourceConfig {
  baseUrl: string
  rpcEndpoint: string
  streamEndpoint?: string
  uploadEndpoint?: string
  csrfToken?: string | (() => string)
  headers?: Record<string, string>
  timeout?: number
  /**
   * @deprecated Pass `onSessionCreated` to `ChatSessionProvider` or
   * `ChatSession` instead. Coupling navigation to the data source causes
   * component remounts during active streams.
   */
  navigateToSession?: (sessionId: string) => void
}

interface SessionState {
  session: Session
  turns: ConversationTurn[]
  pendingQuestion?: PendingQuestion | null
}

interface Result<T> {
  success: boolean
  data?: T
  error?: string
}

interface RPCArtifact {
  id: string
  sessionId: string
  messageId?: string
  uploadId?: number
  type: string
  name: string
  description?: string
  mimeType?: string
  url?: string
  sizeBytes: number
  metadata?: Record<string, unknown>
  createdAt: string
}

interface CoreUploadResponse {
  id: number
  url: string
  path: string
  name: string
  mimetype: string
  size: number
}

function isSessionNotFoundError(err: unknown): boolean {
  if (!(err instanceof AppletRPCException)) return false
  return err.code === 'not_found' || err.code === 'session_not_found'
}

function toSession(session: RPCSession): Session {
  return {
    ...session,
    status: session.status === 'archived' ? 'archived' : 'active',
  }
}

function toSessionArtifact(artifact: RPCArtifact): SessionArtifact {
  return {
    id: artifact.id,
    sessionId: artifact.sessionId,
    messageId: artifact.messageId,
    uploadId: artifact.uploadId,
    type: artifact.type,
    name: artifact.name,
    description: artifact.description,
    mimeType: artifact.mimeType,
    url: artifact.url,
    sizeBytes: artifact.sizeBytes,
    metadata: artifact.metadata,
    createdAt: artifact.createdAt,
  }
}

function warnMalformedSessionPayload(message: string, details?: Record<string, unknown>): void {
  console.warn(`[BiChat] ${message}`, details || {})
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

const SAFE_AUTOCORRECT_MIME_TYPES = new Set(Object.keys(MIME_TO_EXTENSION))

function detectMimeFromSignature(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 8) {
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    if (isPng) return 'image/png'
  }

  if (bytes.length >= 3) {
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    if (isJpeg) return 'image/jpeg'
  }

  if (bytes.length >= 6) {
    const isGif =
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61
    if (isGif) return 'image/gif'
  }

  if (bytes.length >= 4) {
    const isPdf =
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
    if (isPdf) return 'application/pdf'
  }

  return undefined
}

function normalizeFilenameForMime(filename: string, mimeType: string): string {
  const expectedExt = MIME_TO_EXTENSION[mimeType]
  if (!expectedExt) return filename

  const lower = filename.toLowerCase()
  if (mimeType === 'image/jpeg' && (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))) {
    return filename
  }
  if (lower.endsWith(`.${expectedExt}`)) {
    return filename
  }

  const dotIndex = filename.lastIndexOf('.')
  const baseName = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  return `${baseName}.${expectedExt}`
}

function normalizeQuestionType(rawType: unknown): 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' {
  const normalized = readString(rawType).trim().toUpperCase().replace(/[\s-]+/g, '_')
  return normalized === 'MULTIPLE_CHOICE' ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE'
}

function normalizeMessageRole(rawRole: unknown): MessageRole {
  const normalized = readString(rawRole).trim().toLowerCase()
  if (normalized === MessageRole.User) return MessageRole.User
  if (normalized === MessageRole.System) return MessageRole.System
  if (normalized === MessageRole.Tool) return MessageRole.Tool
  return MessageRole.Assistant
}

function sanitizeAttachment(rawAttachment: unknown, turnId: string, index: number): Attachment | null {
  if (!isRecord(rawAttachment)) {
    warnMalformedSessionPayload('Dropped malformed attachment entry', { turnId, index })
    return null
  }

  const filename = readString(rawAttachment.filename, 'attachment')
  const mimeType = readString(rawAttachment.mimeType, 'application/octet-stream')
  const id = readNonEmptyString(rawAttachment.id) || undefined
  const clientKey =
    readNonEmptyString(rawAttachment.clientKey) ||
    id ||
    `${turnId}-attachment-${index}`

  return {
    id,
    clientKey,
    filename,
    mimeType,
    sizeBytes: readFiniteNumber(rawAttachment.sizeBytes),
    uploadId: readOptionalFiniteNumber(rawAttachment.uploadId),
    base64Data: readNonEmptyString(rawAttachment.base64Data) || undefined,
    url: readNonEmptyString(rawAttachment.url) || undefined,
    preview: readNonEmptyString(rawAttachment.preview) || undefined,
  }
}

function sanitizeUserAttachments(rawAttachments: unknown, turnId: string): Attachment[] {
  if (!Array.isArray(rawAttachments)) return []
  const result: Attachment[] = []
  for (let i = 0; i < rawAttachments.length; i++) {
    const sanitized = sanitizeAttachment(rawAttachments[i], turnId, i)
    if (sanitized) result.push(sanitized)
  }
  return result
}

function sanitizeAssistantArtifacts(rawArtifacts: unknown, turnId: string): DownloadArtifact[] {
  if (!Array.isArray(rawArtifacts)) return []
  const artifacts: DownloadArtifact[] = []
  for (let i = 0; i < rawArtifacts.length; i++) {
    const raw = rawArtifacts[i]
    if (!isRecord(raw)) {
      warnMalformedSessionPayload('Dropped malformed assistant artifact', { turnId, index: i })
      continue
    }
    const type = readString(raw.type).toLowerCase()
    if (type !== 'excel' && type !== 'pdf') {
      continue
    }
    const url = readNonEmptyString(raw.url)
    if (!url) {
      warnMalformedSessionPayload('Dropped assistant artifact without url', { turnId, index: i })
      continue
    }
    artifacts.push({
      type,
      filename: readString(raw.filename, 'download'),
      url,
      sizeReadable: readNonEmptyString(raw.sizeReadable) || undefined,
      rowCount:
        typeof raw.rowCount === 'number' && Number.isFinite(raw.rowCount) ? raw.rowCount : undefined,
      description: readNonEmptyString(raw.description) || undefined,
    })
  }
  return artifacts
}

function sanitizeAssistantTurn(
  rawAssistantTurn: unknown,
  fallbackCreatedAt: string,
  turnId: string
): AssistantTurn | undefined {
  if (rawAssistantTurn == null) return undefined
  if (!isRecord(rawAssistantTurn)) {
    warnMalformedSessionPayload('Dropped malformed assistant turn payload', { turnId })
    return undefined
  }

  const assistantID = readNonEmptyString(rawAssistantTurn.id)
  if (!assistantID) {
    warnMalformedSessionPayload('Dropped assistant turn without id', { turnId })
    return undefined
  }

  const citations = Array.isArray(rawAssistantTurn.citations)
    ? rawAssistantTurn.citations
      .filter((item) => isRecord(item))
      .map((item, index) => ({
        id: readString(item.id, `${assistantID}-citation-${index}`),
        type: readString(item.type),
        title: readString(item.title),
        url: readString(item.url),
        startIndex: readFiniteNumber(item.startIndex),
        endIndex: readFiniteNumber(item.endIndex),
        excerpt: readNonEmptyString(item.excerpt) || undefined,
      }))
    : []

  const toolCalls = Array.isArray(rawAssistantTurn.toolCalls)
    ? rawAssistantTurn.toolCalls
      .filter((item) => isRecord(item))
      .map((item, index) => ({
        id: readString(item.id, `${assistantID}-tool-${index}`),
        name: readString(item.name),
        arguments: readString(item.arguments),
        result: readNonEmptyString(item.result) || undefined,
        error: readNonEmptyString(item.error) || undefined,
        durationMs: readFiniteNumber(item.durationMs),
      }))
    : []

  const codeOutputs = Array.isArray(rawAssistantTurn.codeOutputs)
    ? rawAssistantTurn.codeOutputs
      .filter((item) => isRecord(item))
      .map((item) => ({
        type: ((): 'image' | 'text' | 'error' => {
          const normalizedType = readString(item.type, 'text').toLowerCase()
          if (normalizedType === 'image' || normalizedType === 'error') return normalizedType
          return 'text'
        })(),
        content: readString(item.content),
        filename: readNonEmptyString(item.filename) || undefined,
        mimeType: readNonEmptyString(item.mimeType) || undefined,
        sizeBytes: readOptionalFiniteNumber(item.sizeBytes),
      }))
    : []

  const debugTrace = isRecord(rawAssistantTurn.debug)
    ? {
      generationMs: readOptionalFiniteNumber(rawAssistantTurn.debug.generationMs),
      usage: isRecord(rawAssistantTurn.debug.usage)
        ? {
          promptTokens: readFiniteNumber(rawAssistantTurn.debug.usage.promptTokens),
          completionTokens: readFiniteNumber(rawAssistantTurn.debug.usage.completionTokens),
          totalTokens: readFiniteNumber(rawAssistantTurn.debug.usage.totalTokens),
          cachedTokens: readOptionalFiniteNumber(rawAssistantTurn.debug.usage.cachedTokens),
          cost: readOptionalFiniteNumber(rawAssistantTurn.debug.usage.cost),
        }
        : undefined,
      tools: Array.isArray(rawAssistantTurn.debug.tools)
        ? rawAssistantTurn.debug.tools
          .filter((tool) => isRecord(tool))
          .map((tool) => ({
            callId: readNonEmptyString(tool.callId) || undefined,
            name: readString(tool.name),
            arguments: readNonEmptyString(tool.arguments) || undefined,
            result: readNonEmptyString(tool.result) || undefined,
            error: readNonEmptyString(tool.error) || undefined,
            durationMs: readOptionalFiniteNumber(tool.durationMs),
          }))
        : [],
    }
    : undefined

  return {
    id: assistantID,
    role: normalizeMessageRole(rawAssistantTurn.role),
    content: readString(rawAssistantTurn.content),
    explanation: readNonEmptyString(rawAssistantTurn.explanation) || undefined,
    citations,
    toolCalls,
    chartData: undefined,
    renderTables: undefined,
    artifacts: sanitizeAssistantArtifacts(rawAssistantTurn.artifacts, turnId),
    codeOutputs,
    debug: debugTrace,
    createdAt: readString(rawAssistantTurn.createdAt, fallbackCreatedAt),
  }
}

function sanitizeConversationTurn(rawTurn: unknown, index: number, fallbackSessionID: string): ConversationTurn | null {
  if (!isRecord(rawTurn)) {
    warnMalformedSessionPayload('Dropped malformed turn payload (not an object)', { index })
    return null
  }

  if (!isRecord(rawTurn.userTurn)) {
    warnMalformedSessionPayload('Dropped malformed turn payload (missing user turn)', { index })
    return null
  }

  const userTurnID = readNonEmptyString(rawTurn.userTurn.id)
  if (!userTurnID) {
    warnMalformedSessionPayload('Dropped malformed turn payload (missing user turn id)', { index })
    return null
  }

  const turnID = readString(rawTurn.id, userTurnID)
  const createdAt = readString(
    rawTurn.createdAt,
    readString(rawTurn.userTurn.createdAt, new Date().toISOString())
  )

  return {
    id: turnID,
    sessionId: readString(rawTurn.sessionId, fallbackSessionID),
    userTurn: {
      id: userTurnID,
      content: readString(rawTurn.userTurn.content),
      attachments: sanitizeUserAttachments(rawTurn.userTurn.attachments, turnID),
      createdAt: readString(rawTurn.userTurn.createdAt, createdAt),
    },
    assistantTurn: sanitizeAssistantTurn(rawTurn.assistantTurn, createdAt, turnID),
    createdAt,
  }
}

function sanitizeConversationTurns(rawTurns: unknown, sessionID: string): ConversationTurn[] {
  if (!Array.isArray(rawTurns)) {
    warnMalformedSessionPayload('Session payload contained non-array turns field', { sessionID })
    return []
  }

  const turns: ConversationTurn[] = []
  let dropped = 0
  for (let i = 0; i < rawTurns.length; i++) {
    const sanitizedTurn = sanitizeConversationTurn(rawTurns[i], i, sessionID)
    if (sanitizedTurn) {
      turns.push(sanitizedTurn)
    } else {
      dropped++
    }
  }

  if (dropped > 0) {
    warnMalformedSessionPayload('Dropped malformed turns from session payload', {
      sessionID,
      dropped,
      total: rawTurns.length,
    })
  }

  return turns
}

function sanitizePendingQuestion(
  rawPendingQuestion: RPCPendingQuestion | null | undefined,
  sessionID: string
): PendingQuestion | null {
  if (!rawPendingQuestion) return null

  const checkpointID = readNonEmptyString(rawPendingQuestion.checkpointId)
  if (!checkpointID) {
    warnMalformedSessionPayload('Dropped malformed pendingQuestion without checkpointId', { sessionID })
    return null
  }

  if (!Array.isArray(rawPendingQuestion.questions)) {
    warnMalformedSessionPayload('Pending question had non-array questions payload', {
      sessionID,
      checkpointID,
    })
  }

  const questions: Question[] = Array.isArray(rawPendingQuestion.questions)
    ? rawPendingQuestion.questions
      .filter((question) => {
        if (!question || !isRecord(question)) {
          warnMalformedSessionPayload('Dropped malformed question from pendingQuestion', {
            sessionID,
            checkpointID,
          })
          return false
        }
        return true
      })
      .map((question, index) => {
        const questionID = readString(question.id, `${checkpointID}-q-${index}`)
        const options = Array.isArray(question.options)
          ? question.options
            .filter((option) => {
              if (!option || !isRecord(option)) {
                warnMalformedSessionPayload('Dropped malformed pendingQuestion option', {
                  sessionID,
                  checkpointID,
                  questionID,
                })
                return false
              }
              return true
            })
            .map((option, optionIndex) => {
              const label = readString(option.label)
              return {
                id: readString(option.id, `${questionID}-opt-${optionIndex}`),
                label,
                value: label,
              }
            })
          : []

        return {
          id: questionID,
          text: readString(question.text),
          type: normalizeQuestionType(question.type),
          options,
        }
      })
    : []

  return {
    id: checkpointID,
    turnId: readString(rawPendingQuestion.turnId),
    questions,
    status: 'PENDING',
  }
}

function formatSizeReadable(bytes: number): string | undefined {
  if (!Number.isFinite(bytes) || bytes <= 0) return undefined

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx++
  }
  const precision = idx === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(precision)} ${units[idx]}`
}

function parseRowCount(metadata?: Record<string, unknown>): number | undefined {
  if (!metadata) return undefined
  const raw = metadata.row_count ?? metadata.rowCount
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw
  }
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function inferDownloadType(artifact: SessionArtifact): DownloadArtifact['type'] | null {
  const mime = artifact.mimeType?.toLowerCase() || ''
  const name = artifact.name?.toLowerCase() || ''
  const cleanURL = artifact.url?.split('?')[0].toLowerCase() || ''

  const isPDF = mime.includes('pdf') || name.endsWith('.pdf') || cleanURL.endsWith('.pdf')
  if (isPDF) return 'pdf'

  const isExcel =
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    cleanURL.endsWith('.xlsx') ||
    cleanURL.endsWith('.xls')
  if (isExcel) return 'excel'

  return null
}

function extractFilename(artifact: SessionArtifact): string {
  const name = artifact.name?.trim()
  if (name) return name

  const urlPath = artifact.url?.split('?')[0] || ''
  const fromURL = urlPath.split('/').filter(Boolean).pop()
  if (fromURL) return fromURL

  return 'download'
}

function toDownloadArtifact(artifact: SessionArtifact): DownloadArtifact | null {
  if (!artifact.url) return null
  const type = inferDownloadType(artifact)
  if (!type) return null

  return {
    type,
    filename: extractFilename(artifact),
    url: artifact.url,
    sizeReadable: formatSizeReadable(artifact.sizeBytes),
    rowCount: parseRowCount(artifact.metadata),
    description: artifact.description,
  }
}

function extractChartDataFromToolCalls(toolCalls?: Array<{ name: string; result?: string }>): import('../types').ChartData | undefined {
  if (!toolCalls) return undefined
  for (const tc of toolCalls) {
    if (tc.name === 'draw_chart' && tc.result) {
      const parsed = parseChartDataFromJsonString(tc.result)
      if (parsed) return parsed
    }
  }
  return undefined
}

function extractRenderTablesFromToolCalls(toolCalls?: Array<{ id: string; name: string; result?: string }>): RenderTableData[] {
  if (!toolCalls) return []

  const tables: RenderTableData[] = []
  for (const tc of toolCalls) {
    if (tc.name !== 'renderTable' || !tc.result) continue
    const parsed = parseRenderTableDataFromJsonString(tc.result, tc.id)
    if (parsed) {
      tables.push(parsed)
    }
  }

  return tables
}

const EXPORT_TOOL_NAMES: Record<string, DownloadArtifact['type']> = {
  export_query_to_excel: 'excel',
  export_data_to_excel: 'excel',
  export_to_pdf: 'pdf',
}

function extractDownloadArtifactsFromToolCalls(toolCalls?: Array<{ name: string; result?: string }>): DownloadArtifact[] {
  if (!toolCalls) return []
  const artifacts: DownloadArtifact[] = []
  for (const tc of toolCalls) {
    const type = EXPORT_TOOL_NAMES[tc.name]
    if (!type || !tc.result) continue

    let parsed: unknown
    try { parsed = JSON.parse(tc.result) } catch { continue }
    if (!isRecord(parsed) || typeof parsed.url !== 'string' || !parsed.url) continue

    const filename = typeof parsed.filename === 'string' && parsed.filename
      ? parsed.filename
      : parsed.url.split('/').pop() || 'download'

    const sizeKB = typeof parsed.file_size_kb === 'number' ? parsed.file_size_kb : undefined
    const sizeBytes = typeof parsed.size === 'number' ? parsed.size : (sizeKB != null ? sizeKB * 1024 : undefined)

    artifacts.push({
      type,
      filename,
      url: parsed.url,
      sizeReadable: sizeBytes != null ? formatSizeReadable(sizeBytes) : undefined,
      rowCount: parseRowCount(parsed as Record<string, unknown>),
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
    })
  }
  return artifacts
}

function normalizeAssistantTurn(turn: Partial<AssistantTurn> & { id: string; content: string; createdAt: string }): AssistantTurn {
  const existingArtifacts = turn.artifacts || []
  const fromToolCalls = extractDownloadArtifactsFromToolCalls(turn.toolCalls)
  const renderTables = turn.renderTables || extractRenderTablesFromToolCalls(turn.toolCalls)
  // Merge: add tool-call artifacts that aren't already present (by URL + filename)
  const merged = [...existingArtifacts]
  for (const a of fromToolCalls) {
    if (!merged.some((e) => e.url === a.url && e.filename === a.filename)) {
      merged.push(a)
    }
  }

  return {
    ...turn,
    role: (turn.role as MessageRole) || MessageRole.Assistant,
    chartData: turn.chartData || extractChartDataFromToolCalls(turn.toolCalls),
    renderTables,
    citations: turn.citations || [],
    artifacts: merged,
    codeOutputs: turn.codeOutputs || [],
  }
}

function normalizeTurns(raw: ConversationTurn[]): ConversationTurn[] {
  return raw.map((turn) => {
    if (!turn.assistantTurn) return turn
    return {
      ...turn,
      assistantTurn: normalizeAssistantTurn(turn.assistantTurn),
    }
  })
}

function toMillis(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function attachArtifactsToTurns(
  turns: ConversationTurn[],
  artifacts: SessionArtifact[]
): ConversationTurn[] {
  if (artifacts.length === 0) return turns

  const downloadArtifacts = artifacts
    .map((raw) => ({ raw, mapped: toDownloadArtifact(raw) }))
    .filter((entry): entry is { raw: SessionArtifact; mapped: DownloadArtifact } => entry.mapped !== null)
    .sort((a, b) => toMillis(a.raw.createdAt) - toMillis(b.raw.createdAt))

  const chartArtifacts = artifacts
    .filter((a) => a.type === 'chart')
    .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))

  if (downloadArtifacts.length === 0 && chartArtifacts.length === 0) return turns

  const nextTurns = turns.map((turn) => {
    if (!turn.assistantTurn) {
      return turn
    }
    return {
      ...turn,
      assistantTurn: {
        ...turn.assistantTurn,
        artifacts: [...(turn.assistantTurn.artifacts || [])],
      },
    }
  })

  const turnIndexByMessageID = new Map<string, number>()

  nextTurns.forEach((turn, index) => {
    turnIndexByMessageID.set(turn.userTurn.id, index)

    const assistantTurn = turn.assistantTurn
    if (!assistantTurn) return
    turnIndexByMessageID.set(assistantTurn.id, index)
  })

  for (const entry of downloadArtifacts) {
    const messageID = entry.raw.messageId
    // Only attach artifacts that are explicitly linked to a message.
    // Orphan artifacts (uploaded via the artifacts panel) have no messageId
    // and should not appear on any message.
    if (!messageID) continue
    const targetIndex = turnIndexByMessageID.get(messageID)
    if (targetIndex === undefined) continue

    const assistantTurn = nextTurns[targetIndex]?.assistantTurn
    if (!assistantTurn) continue

    const exists = assistantTurn.artifacts.some(
      (existing) =>
        existing.url === entry.mapped.url && existing.filename === entry.mapped.filename
    )
    if (!exists) {
      assistantTurn.artifacts.push(entry.mapped)
    }
  }

  for (const raw of chartArtifacts) {
    const messageID = raw.messageId
    if (!messageID) continue
    const targetIndex = turnIndexByMessageID.get(messageID)
    if (targetIndex === undefined) continue

    const assistantTurn = nextTurns[targetIndex]?.assistantTurn
    if (!assistantTurn) continue

    if (assistantTurn.chartData) continue

    const metadata = raw.metadata
    if (!metadata || typeof metadata !== 'object' || metadata === null) continue
    const spec =
      metadata.spec && typeof metadata.spec === 'object' && metadata.spec !== null
        ? (metadata.spec as Record<string, unknown>)
        : (metadata as Record<string, unknown>)

    const chartData = parseChartDataFromSpec(spec, raw.name)
    if (chartData) {
      assistantTurn.chartData = chartData
    }
  }

  return nextTurns
}

export class HttpDataSource implements ChatDataSource {
  private config: HttpDataSourceConfig
  private abortController: AbortController | null = null
  private rpc: ReturnType<typeof createAppletRPCClient>

  constructor(config: HttpDataSourceConfig) {
    this.config = {
      streamEndpoint: '/stream',
      uploadEndpoint: '/api/uploads',
      timeout: 120000,
      ...config,
    }
    if (config.navigateToSession) {
      this.navigateToSession = config.navigateToSession
    }
    this.rpc = createAppletRPCClient({
      endpoint: `${this.config.baseUrl}${this.config.rpcEndpoint}`,
      timeoutMs: this.config.timeout,
    })
  }

  /**
   * Get CSRF token from config
   */
  private getCSRFToken(): string {
    if (!this.config.csrfToken) {
      return ''
    }
    return typeof this.config.csrfToken === 'function'
      ? this.config.csrfToken()
      : this.config.csrfToken
  }

  /**
   * Create headers for HTTP requests
   */
  private createHeaders(additionalHeaders?: Record<string, string>): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...additionalHeaders,
    })

    const csrfToken = this.getCSRFToken()
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }

    return headers
  }

  private createUploadHeaders(additionalHeaders?: Record<string, string>): Headers {
    const headers = new Headers({
      ...this.config.headers,
      ...additionalHeaders,
    })

    const csrfToken = this.getCSRFToken()
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }
    headers.delete('Content-Type')

    return headers
  }

  private logAttachmentLifecycle(
    event: 'attachment_decode_start' | 'attachment_decode_success' | 'attachment_decode_fail'
    | 'attachment_upload_start' | 'attachment_upload_success' | 'attachment_upload_fail'
    | 'stream_send_with_upload_ids',
    details: Record<string, unknown>
  ): void {
    const payload = {
      source: 'HttpDataSource',
      event,
      ...details,
    }

    if (event.endsWith('_fail')) {
      console.warn('[bichat.attachments]', payload)
      return
    }
    console.warn('[bichat.attachments]', payload)
  }

  private async normalizeAttachmentFile(attachment: Attachment, file: File): Promise<File> {
    const signatureBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    const detectedMimeType = detectMimeFromSignature(signatureBytes)
    const declaredMimeType = (attachment.mimeType || file.type || '').trim().toLowerCase()

    let resolvedMimeType = declaredMimeType || detectedMimeType || 'application/octet-stream'
    let correctedFromDeclared = false

    if (detectedMimeType && declaredMimeType && detectedMimeType !== declaredMimeType) {
      const safeToCorrect =
        SAFE_AUTOCORRECT_MIME_TYPES.has(detectedMimeType) &&
        SAFE_AUTOCORRECT_MIME_TYPES.has(declaredMimeType)

      if (!safeToCorrect) {
        throw new Error(
          `Attachment "${attachment.filename}" MIME mismatch: declared "${declaredMimeType}", detected "${detectedMimeType}"`
        )
      }

      resolvedMimeType = detectedMimeType
      correctedFromDeclared = true
    } else if (detectedMimeType && !declaredMimeType) {
      resolvedMimeType = detectedMimeType
    }

    const normalizedName = normalizeFilenameForMime(attachment.filename, resolvedMimeType)
    const normalized = new File([file], normalizedName, {
      type: resolvedMimeType,
      lastModified: file.lastModified,
    })

    this.logAttachmentLifecycle('attachment_decode_success', {
      attachmentKey: attachment.clientKey,
      filename: attachment.filename,
      normalizedFilename: normalized.name,
      declaredMimeType: declaredMimeType || undefined,
      detectedMimeType,
      resolvedMimeType,
      correctedFromDeclared,
      sizeBytes: normalized.size,
    })

    return normalized
  }

  private async uploadFile(file: File): Promise<CoreUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.config.baseUrl}${this.config.uploadEndpoint}`, {
      method: 'POST',
      headers: this.createUploadHeaders(),
      body: formData,
    })

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      const errorMessage = isRecord(payload) && typeof payload.error === 'string'
        ? payload.error
        : `Upload failed: HTTP ${response.status}`
      throw new Error(errorMessage)
    }

    if (!isRecord(payload) || typeof payload.id !== 'number' || payload.id <= 0) {
      throw new Error('Upload failed: invalid response payload')
    }

    return {
      id: payload.id,
      url: typeof payload.url === 'string' ? payload.url : '',
      path: typeof payload.path === 'string' ? payload.path : '',
      name: typeof payload.name === 'string' ? payload.name : file.name,
      mimetype: typeof payload.mimetype === 'string' ? payload.mimetype : file.type,
      size: typeof payload.size === 'number' && Number.isFinite(payload.size) ? payload.size : file.size,
    }
  }

  private async attachmentToFile(attachment: Attachment): Promise<File> {
    if (attachment.base64Data && attachment.base64Data.trim().length > 0) {
      try {
        const base64Data = attachment.base64Data.trim()
        const dataUrl = base64Data.startsWith('data:')
          ? base64Data
          : `data:${attachment.mimeType || 'application/octet-stream'};base64,${base64Data}`
        const blob = await fetch(dataUrl).then((response) => response.blob())
        return new File([blob], attachment.filename, {
          type: attachment.mimeType || blob.type || 'application/octet-stream',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown decode error'
        throw new Error(`Attachment "${attachment.filename}" decode failed: ${message}`)
      }
    }

    if (attachment.url) {
      const response = await fetch(attachment.url)
      if (!response.ok) {
        throw new Error(`Attachment "${attachment.filename}" decode failed: source HTTP ${response.status}`)
      }
      const blob = await response.blob()
      return new File([blob], attachment.filename, {
        type: attachment.mimeType || blob.type || 'application/octet-stream',
      })
    }

    throw new Error(`Attachment "${attachment.filename}" has no uploadable data`)
  }

  private assertUploadReferences(uploads: CoreUploadResponse[]): Array<{ uploadId: number }> {
    return uploads.map((upload, index) => {
      if (typeof upload.id !== 'number' || !Number.isFinite(upload.id) || upload.id <= 0) {
        throw new Error(`Attachment upload reference is invalid at index ${index}`)
      }
      return { uploadId: upload.id }
    })
  }

  private async ensureAttachmentUpload(
    attachment: Attachment,
    context: { sessionId: string; attachmentIndex: number }
  ): Promise<CoreUploadResponse> {
    if (typeof attachment.uploadId === 'number' && attachment.uploadId > 0) {
      this.logAttachmentLifecycle('attachment_upload_success', {
        sessionId: context.sessionId,
        attachmentIndex: context.attachmentIndex,
        attachmentKey: attachment.clientKey,
        filename: attachment.filename,
        uploadId: attachment.uploadId,
        reusedUploadId: true,
      })
      return {
        id: attachment.uploadId,
        url: attachment.url || '',
        path: '',
        name: attachment.filename,
        mimetype: attachment.mimeType,
        size: attachment.sizeBytes,
      }
    }

    this.logAttachmentLifecycle('attachment_decode_start', {
      sessionId: context.sessionId,
      attachmentIndex: context.attachmentIndex,
      attachmentKey: attachment.clientKey,
      filename: attachment.filename,
      hasBase64Data: Boolean(attachment.base64Data && attachment.base64Data.trim().length > 0),
      hasURL: Boolean(attachment.url),
    })

    let file: File
    try {
      const rawFile = await this.attachmentToFile(attachment)
      file = await this.normalizeAttachmentFile(attachment, rawFile)
      validateAttachmentFile(file)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown attachment decode/validation error'
      this.logAttachmentLifecycle('attachment_decode_fail', {
        sessionId: context.sessionId,
        attachmentIndex: context.attachmentIndex,
        attachmentKey: attachment.clientKey,
        filename: attachment.filename,
        error: message,
      })
      throw new Error(message)
    }

    this.logAttachmentLifecycle('attachment_upload_start', {
      sessionId: context.sessionId,
      attachmentIndex: context.attachmentIndex,
      attachmentKey: attachment.clientKey,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    })

    try {
      const upload = await this.uploadFile(file)
      attachment.uploadId = upload.id
      attachment.mimeType = upload.mimetype || file.type
      attachment.filename = upload.name || file.name
      attachment.sizeBytes = upload.size || file.size
      this.logAttachmentLifecycle('attachment_upload_success', {
        sessionId: context.sessionId,
        attachmentIndex: context.attachmentIndex,
        attachmentKey: attachment.clientKey,
        filename: attachment.filename,
        uploadId: upload.id,
        reusedUploadId: false,
      })
      return upload
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown upload error'
      this.logAttachmentLifecycle('attachment_upload_fail', {
        sessionId: context.sessionId,
        attachmentIndex: context.attachmentIndex,
        attachmentKey: attachment.clientKey,
        filename: file.name,
        error: message,
      })
      throw new Error(`Attachment "${attachment.filename}" upload failed: ${message}`)
    }
  }

  private async callRPC<TMethod extends keyof BichatRPC & string>(
    method: TMethod,
    params: BichatRPC[TMethod]['params']
  ): Promise<BichatRPC[TMethod]['result']> {
    return this.rpc.callTyped<BichatRPC, TMethod>(method, params)
  }

  /**
   * Create a new chat session
   */
  async createSession(): Promise<Session> {
    const data = await this.callRPC('bichat.session.create', { title: '' })
    return toSession(data.session)
  }

  /**
   * Fetch an existing session with turns (turn-based architecture)
   */
  async fetchSession(id: string): Promise<SessionState | null> {
    try {
      const [data, artifactsData] = await Promise.all([
        this.callRPC('bichat.session.get', { id }),
        this.fetchSessionArtifacts(id, { limit: 200, offset: 0 }).catch((err) => {
          console.warn('Failed to fetch session artifacts:', err)
          return { artifacts: [] as SessionArtifact[], hasMore: false, nextOffset: 0 }
        }),
      ])

      const sanitizedTurns = sanitizeConversationTurns(data.turns, id)
      const turns = attachArtifactsToTurns(
        normalizeTurns(sanitizedTurns),
        artifactsData.artifacts || []
      )
      const pendingQuestion = sanitizePendingQuestion(data.pendingQuestion, id)

      if (data.pendingQuestion && pendingQuestion && pendingQuestion.questions.length === 0) {
        warnMalformedSessionPayload('Pending question normalized to zero renderable questions', {
          sessionID: id,
          checkpointID: pendingQuestion.id,
        })
      }

      return {
        session: toSession(data.session),
        turns,
        pendingQuestion,
      }
    } catch (err) {
      if (isSessionNotFoundError(err)) {
        return null
      }
      console.error('Failed to fetch session:', err)
      throw err instanceof Error ? err : new Error('Failed to fetch session')
    }
  }

  async fetchSessionArtifacts(
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ artifacts: SessionArtifact[]; hasMore?: boolean; nextOffset?: number }> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0
    const data = await this.callRPC('bichat.session.artifacts', {
      sessionId,
      limit,
      offset,
    })

    const artifacts = (data.artifacts || []).map((artifact) => toSessionArtifact(artifact))
    const hasMore =
      typeof data.hasMore === 'boolean'
        ? data.hasMore
        : artifacts.length >= limit
    const nextOffset =
      typeof data.nextOffset === 'number'
        ? data.nextOffset
        : offset + artifacts.length

    return {
      artifacts,
      hasMore,
      nextOffset,
    }
  }

  async uploadSessionArtifacts(
    sessionId: string,
    files: File[]
  ): Promise<{ artifacts: SessionArtifact[] }> {
    if (!Array.isArray(files) || files.length === 0) {
      return { artifacts: [] }
    }

    validateFileCount(0, files.length, 10)
    files.forEach((file) => validateAttachmentFile(file))
    const uploads = await Promise.all(files.map((file) => this.uploadFile(file)))

    const data = await this.callRPC('bichat.session.uploadArtifacts', {
      sessionId,
      attachments: uploads.map((upload) => ({
        uploadId: upload.id,
      })),
    })

    return {
      artifacts: (data.artifacts || []).map((artifact) => toSessionArtifact(artifact)),
    }
  }

  async renameSessionArtifact(
    artifactId: string,
    name: string,
    description: string = ''
  ): Promise<SessionArtifact> {
    const data = await this.callRPC('bichat.artifact.update', {
      id: artifactId,
      name,
      description,
    })
    return toSessionArtifact(data.artifact as RPCArtifact)
  }

  async deleteSessionArtifact(artifactId: string): Promise<void> {
    await this.callRPC('bichat.artifact.delete', { id: artifactId })
  }

  /**
   * Send a message and stream the response using SSE
   */
  async *sendMessage(
    sessionId: string,
    content: string,
    attachments: Attachment[] = [],
    signal?: AbortSignal,
    options?: SendMessageOptions
  ): AsyncGenerator<StreamChunk> {
    // Create new abort controller for this stream
    this.abortController = new AbortController()

    // Link external signal if provided, with cleanup
    let onExternalAbort: (() => void) | undefined
    if (signal) {
      onExternalAbort = () => { this.abortController?.abort() }
      signal.addEventListener('abort', onExternalAbort)
    }

    const url = `${this.config.baseUrl}${this.config.streamEndpoint}`

    let connectionTimeoutID: ReturnType<typeof setTimeout> | undefined
    let connectionTimedOut = false
    try {
      const uploads = await Promise.all(
        attachments.map((attachment, attachmentIndex) =>
          this.ensureAttachmentUpload(attachment, { sessionId, attachmentIndex })
        )
      )
      const streamAttachments = this.assertUploadReferences(uploads)
      this.logAttachmentLifecycle('stream_send_with_upload_ids', {
        sessionId,
        attachmentCount: streamAttachments.length,
      })
      const payload = {
        sessionId,
        content,
        debugMode: options?.debugMode ?? false,
        replaceFromMessageId: options?.replaceFromMessageID,
        attachments: streamAttachments,
      }

      const timeoutMs = this.config.timeout ?? 0
      if (timeoutMs > 0) {
        connectionTimeoutID = setTimeout(() => {
          connectionTimedOut = true
          this.abortController?.abort()
        }, timeoutMs)
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify(payload),
        signal: this.abortController.signal,
      })
      if (connectionTimeoutID !== undefined) {
        clearTimeout(connectionTimeoutID)
        connectionTimeoutID = undefined
      }

      if (!response.ok) {
        throw new Error(`Stream request failed: HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()

      for await (const chunk of parseBichatStream(reader)) {
        yield chunk

        if (chunk.type === 'done' || chunk.type === 'error') {
          return
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          yield {
            type: 'error',
            error: connectionTimedOut
              ? `Stream request timed out after ${this.config.timeout}ms`
              : 'Stream cancelled',
          }
        } else {
          yield {
            type: 'error',
            error: err.message,
          }
        }
      } else {
        yield {
          type: 'error',
          error: 'Unknown error',
        }
      }
    } finally {
      if (connectionTimeoutID !== undefined) {
        clearTimeout(connectionTimeoutID)
      }
      if (signal && onExternalAbort) {
        signal.removeEventListener('abort', onExternalAbort)
      }
      this.abortController = null
    }
  }

  /**
   * Cancel ongoing stream
   */
  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * Clear session history in-place.
   */
  async clearSessionHistory(sessionId: string): Promise<{
    success: boolean
    deletedMessages: number
    deletedArtifacts: number
  }> {
    return this.callRPC('bichat.session.clear', { id: sessionId })
  }

  /**
   * Compact session history into summarized turn.
   */
  async compactSessionHistory(sessionId: string): Promise<{
    success: boolean
    summary: string
    deletedMessages: number
    deletedArtifacts: number
  }> {
    return this.callRPC('bichat.session.compact', { id: sessionId })
  }

  /**
   * Submit answers to a pending question
   */
  async submitQuestionAnswers(
    sessionId: string,
    questionId: string,
    answers: QuestionAnswers
  ): Promise<Result<void>> {
    try {
      // Convert QuestionAnswers to flat map[string]string for RPC
      const flatAnswers: Record<string, string> = {}
      for (const [qId, answerData] of Object.entries(answers)) {
        if (answerData.customText) {
          flatAnswers[qId] = answerData.customText
        } else if (answerData.options.length > 0) {
          flatAnswers[qId] = answerData.options.join(', ')
        }
      }
      await this.callRPC('bichat.question.submit', {
        sessionId,
        checkpointId: questionId,
        answers: flatAnswers,
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /**
   * Reject a pending question
   */
  async rejectPendingQuestion(sessionId: string): Promise<Result<void>> {
    try {
      await this.callRPC('bichat.question.reject', { sessionId })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /**
   * Navigate to a session (optional, for SPA routing)
   */
  navigateToSession?(sessionId: string): void {
    // Default implementation - can be overridden
    if (typeof window !== 'undefined') {
      window.location.href = `/chat/${sessionId}`
    }
  }

  // Session management
  async listSessions(options?: {
    limit?: number
    offset?: number
    includeArchived?: boolean
  }): Promise<SessionListResult> {
    const data = await this.callRPC('bichat.session.list', {
      limit: options?.limit ?? 200,
      offset: options?.offset ?? 0,
      includeArchived: options?.includeArchived ?? false,
    })
    return {
      sessions: data.sessions.map(toSession),
      total: typeof data.total === 'number' ? data.total : data.sessions.length,
      hasMore: typeof data.hasMore === 'boolean' ? data.hasMore : false,
    }
  }
  async archiveSession(sessionId: string): Promise<Session> {
    const data = await this.callRPC('bichat.session.archive', { id: sessionId })
    return toSession(data.session)
  }
  async unarchiveSession(sessionId: string): Promise<Session> {
    const data = await this.callRPC('bichat.session.unarchive', { id: sessionId })
    return toSession(data.session)
  }
  async pinSession(sessionId: string): Promise<Session> {
    const data = await this.callRPC('bichat.session.pin', { id: sessionId })
    return toSession(data.session)
  }
  async unpinSession(sessionId: string): Promise<Session> {
    const data = await this.callRPC('bichat.session.unpin', { id: sessionId })
    return toSession(data.session)
  }
  async deleteSession(sessionId: string): Promise<void> {
    await this.callRPC('bichat.session.delete', { id: sessionId })
  }
  async renameSession(sessionId: string, title: string): Promise<Session> {
    const data = await this.callRPC('bichat.session.updateTitle', { id: sessionId, title })
    return toSession(data.session)
  }
  async regenerateSessionTitle(sessionId: string): Promise<Session> {
    const data = await this.callRPC('bichat.session.regenerateTitle', { id: sessionId })
    return toSession(data.session)
  }
}

/**
 * Factory function to create HttpDataSource
 */
export function createHttpDataSource(config: HttpDataSourceConfig): ChatDataSource {
  return new HttpDataSource(config)
}
