import type {
  ActivityStep,
  Attachment,
  AssistantTurn,
  Artifact,
  ChartData,
  Citation,
  CodeOutput,
  ConversationTurn,
  PendingQuestion,
  Question,
  RenderTableData,
  Session,
  SessionUser,
  UserTurn,
  ImageAttachment,
} from '../../src/bichat/types'
import { MessageRole } from '../../src/bichat/types'

import { base64FromDataUrl, largeImageDataUrl, smallImageDataUrl } from './imageFixtures'
import { flowingMarkdown, largeText, veryLargeText } from './textFixtures'

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString()
}

export function makeSession(partial?: Partial<Session>): Session {
  return {
    id: partial?.id ?? 'session-1',
    title: partial?.title ?? 'Storybook Session',
    status: partial?.status ?? 'active',
    pinned: partial?.pinned ?? false,
    createdAt: partial?.createdAt ?? isoNow(-1000 * 60 * 60),
    updatedAt: partial?.updatedAt ?? isoNow(-1000 * 60 * 5),
  }
}

export function makeCitation(partial?: Partial<Citation>): Citation {
  return {
    id: partial?.id ?? `cit-${Math.random().toString(36).slice(2)}`,
    type: partial?.type ?? 'url_citation',
    title: partial?.title ?? 'Example source',
    url: partial?.url ?? 'https://example.com',
    startIndex: partial?.startIndex ?? 0,
    endIndex: partial?.endIndex ?? 10,
    excerpt: partial?.excerpt,
  }
}

export function makeChartData(overrides?: Partial<ChartData>): ChartData {
  return {
    chartType: overrides?.chartType ?? 'line',
    title: overrides?.title ?? 'Orders (last 12 weeks)',
    labels: overrides?.labels ?? Array.from({ length: 12 }).map((_, i) => `W${i + 1}`),
    series:
      overrides?.series ??
      [
        {
          name: 'Orders',
          data: Array.from({ length: 12 }).map((_, i) => 40 + i * 3 + (i % 3) * 5),
        },
      ],
    colors: overrides?.colors,
    height: overrides?.height,
  }
}

export function makeCodeOutputs(): CodeOutput[] {
  return [
    {
      type: 'text',
      content: 'Preview: generated 3 rows.\nOK.',
      filename: 'output.txt',
      mimeType: 'text/plain',
      sizeBytes: 128,
    },
    {
      type: 'image',
      content: smallImageDataUrl,
      filename: 'chart.png',
      mimeType: 'image/png',
      sizeBytes: 42_000,
    },
  ]
}

export function makeArtifacts(): Artifact[] {
  return [
    {
      type: 'excel',
      filename: 'export.xlsx',
      url: '#',
      sizeReadable: '184 KB',
      rowCount: 1234,
      description: 'Exported table',
    },
    {
      type: 'pdf',
      filename: 'report.pdf',
      url: '#',
      sizeReadable: '2.1 MB',
      description: 'Generated report',
    },
  ]
}

export function makeAttachment(partial?: Partial<Attachment>): Attachment {
  return {
    clientKey: partial?.clientKey ?? crypto.randomUUID(),
    id: partial?.id,
    filename: partial?.filename ?? 'image.png',
    mimeType: partial?.mimeType ?? 'image/svg+xml',
    sizeBytes: partial?.sizeBytes ?? 12345,
    base64Data: partial?.base64Data,
  }
}

export function makeImageAttachment(partial?: Partial<ImageAttachment>): ImageAttachment {
  const preview = partial?.preview ?? smallImageDataUrl
  return {
    clientKey: partial?.clientKey ?? crypto.randomUUID(),
    id: partial?.id,
    filename: partial?.filename ?? 'preview.svg',
    mimeType: partial?.mimeType ?? 'image/svg+xml',
    sizeBytes: partial?.sizeBytes ?? 12345,
    base64Data: partial?.base64Data ?? base64FromDataUrl(preview),
    preview,
  }
}

export function makeUserTurn(partial?: Partial<UserTurn>): UserTurn {
  const now = isoNow(-1000 * 60 * 3)
  return {
    id: partial?.id ?? `user-${Math.random().toString(36).slice(2)}`,
    content: partial?.content ?? 'Show me the revenue breakdown by region for the last quarter.',
    attachments: partial?.attachments ?? [],
    createdAt: partial?.createdAt ?? now,
  }
}

export function makeAssistantTurn(partial?: Partial<AssistantTurn>): AssistantTurn {
  const now = isoNow(-1000 * 60 * 2)
  return {
    id: partial?.id ?? `asst-${Math.random().toString(36).slice(2)}`,
    role: partial?.role ?? MessageRole.Assistant,
    content: partial?.content ?? flowingMarkdown,
    explanation: partial?.explanation,
    citations: partial?.citations ?? [makeCitation(), makeCitation({ title: 'Internal dashboard', url: '#' })],
    charts: partial?.charts,
    artifacts: partial?.artifacts ?? [],
    codeOutputs: partial?.codeOutputs ?? [],
    lifecycle: partial?.lifecycle ?? 'complete',
    createdAt: partial?.createdAt ?? now,
  }
}

export function makeConversationTurn(partial?: Partial<ConversationTurn>): ConversationTurn {
  const now = isoNow(-1000 * 60 * 4)
  const sessionId = partial?.sessionId ?? 'session-1'
  return {
    id: partial?.id ?? `turn-${Math.random().toString(36).slice(2)}`,
    sessionId,
    userTurn: partial?.userTurn ?? makeUserTurn(),
    assistantTurn: partial?.assistantTurn,
    createdAt: partial?.createdAt ?? now,
  }
}

export function makePendingQuestion(partial?: Partial<PendingQuestion>): PendingQuestion {
  const q: Question = {
    id: 'q-1',
    text: 'Which regions should the report include?',
    type: 'MULTIPLE_CHOICE',
    required: true,
    options: [
      { id: 'o-1', label: 'EMEA', value: 'EMEA' },
      { id: 'o-2', label: 'APAC', value: 'APAC' },
      { id: 'o-3', label: 'AMER', value: 'AMER' },
    ],
  }
  return {
    id: partial?.id ?? 'pending-1',
    turnId: partial?.turnId ?? 'turn-1',
    questions: partial?.questions ?? [q],
    status: partial?.status ?? 'PENDING',
  }
}

// ---------------------------------------------------------------------------
// Activity Trace Fixtures
// ---------------------------------------------------------------------------

export function makeActivityStep(partial?: Partial<ActivityStep>): ActivityStep {
  const now = Date.now()
  return {
    id: partial?.id ?? `step-${Math.random().toString(36).slice(2)}`,
    type: partial?.type ?? 'tool',
    toolName: partial?.toolName ?? 'query_database',
    arguments: partial?.arguments,
    agentName: partial?.agentName,
    status: partial?.status ?? 'active',
    startedAt: partial?.startedAt ?? now,
    completedAt: partial?.completedAt,
    durationMs: partial?.durationMs,
  }
}

export function makeActivitySteps(): ActivityStep[] {
  const now = Date.now()
  return [
    makeActivityStep({
      id: 'step-1',
      type: 'tool',
      toolName: 'query_database',
      status: 'completed',
      startedAt: now - 3200,
      completedAt: now - 2000,
      durationMs: 1200,
    }),
    makeActivityStep({
      id: 'step-2',
      type: 'tool',
      toolName: 'run_code',
      arguments: JSON.stringify({ language: 'python' }),
      status: 'completed',
      startedAt: now - 2000,
      completedAt: now - 800,
      durationMs: 1200,
    }),
    makeActivityStep({
      id: 'step-3',
      type: 'tool',
      toolName: 'generate_chart',
      status: 'active',
      startedAt: now - 500,
    }),
  ]
}

export function makeAgentActivitySteps(): ActivityStep[] {
  const now = Date.now()
  return [
    makeActivityStep({
      id: 'step-4',
      type: 'agent_delegation',
      toolName: 'delegate_task',
      agentName: 'Data Analyst',
      status: 'completed',
      startedAt: now - 4000,
      completedAt: now - 3500,
      durationMs: 500,
    }),
    ...makeActivitySteps(),
    makeActivityStep({
      id: 'step-5',
      type: 'tool',
      toolName: 'fetch_metrics',
      agentName: 'Data Analyst',
      status: 'active',
      startedAt: now - 300,
    }),
  ]
}

// ---------------------------------------------------------------------------
// Render Table Fixtures
// ---------------------------------------------------------------------------

export function makeRenderTableData(partial?: Partial<RenderTableData>): RenderTableData {
  return {
    id: partial?.id ?? 'table-1',
    title: partial?.title ?? 'Revenue by Region (Q4 2025)',
    query: partial?.query ?? 'SELECT region, revenue, growth FROM quarterly_revenue ORDER BY revenue DESC',
    columns: partial?.columns ?? ['region', 'revenue', 'growth', 'customers', 'avg_order'],
    columnTypes: partial?.columnTypes ?? ['string', 'number', 'number', 'number', 'number'],
    headers: partial?.headers ?? ['Region', 'Revenue ($)', 'Growth (%)', 'Customers', 'Avg Order ($)'],
    rows: partial?.rows ?? [
      ['EMEA', 1_240_000, 18.5, 3420, 362],
      ['APAC', 980_000, 24.2, 2890, 339],
      ['AMER', 1_850_000, 12.1, 5100, 363],
      ['LATAM', 420_000, 31.0, 1200, 350],
      ['MEA', 310_000, 8.4, 890, 348],
    ],
    totalRows: partial?.totalRows ?? 5,
    pageSize: partial?.pageSize ?? 20,
    truncated: partial?.truncated ?? false,
    export: partial?.export,
    exportPrompt: partial?.exportPrompt,
  }
}

// ---------------------------------------------------------------------------
// Session List Fixtures (for Sidebar / AllChatsList)
// ---------------------------------------------------------------------------

export function makeSessionUser(partial?: Partial<SessionUser>): SessionUser {
  return {
    id: partial?.id ?? `user-${Math.random().toString(36).slice(2)}`,
    firstName: partial?.firstName ?? 'Story',
    lastName: partial?.lastName ?? 'Book',
    initials: partial?.initials ?? 'SB',
  }
}

export function makeSessions(count = 8): Session[] {
  const titles = [
    'Revenue analysis Q4',
    'Customer churn breakdown',
    'Marketing campaign ROI',
    'Product roadmap review',
    'Team capacity planning',
    'Quarterly OKR review',
    'Budget forecasting 2026',
    'User retention analysis',
    'Supply chain optimization',
    'Sales pipeline review',
  ]
  return Array.from({ length: count }).map((_, i) => {
    const dayOffset = i * 24 * 60 * 60 * 1000
    return makeSession({
      id: `session-${i + 1}`,
      title: titles[i % titles.length],
      pinned: i < 2,
      createdAt: isoNow(-dayOffset - 3600000),
      updatedAt: isoNow(-dayOffset),
    })
  })
}

// ---------------------------------------------------------------------------
// Pre-built Turn Arrays
// ---------------------------------------------------------------------------

export const turnsShort: ConversationTurn[] = [
  makeConversationTurn({
    id: 'turn-1',
    assistantTurn: makeAssistantTurn({
      content: largeText,
      charts: [makeChartData()],
      artifacts: makeArtifacts(),
      codeOutputs: makeCodeOutputs(),
    }),
  }),
]

export const turnsLong: ConversationTurn[] = Array.from({ length: 24 }).map((_, i) => {
  const hasChart = i % 6 === 0
  const hasArtifacts = i % 8 === 0
  const hasCode = i % 7 === 0
  return makeConversationTurn({
    id: `turn-${i + 1}`,
    createdAt: isoNow(-1000 * 60 * (60 - i)),
    userTurn: makeUserTurn({
      id: `user-${i + 1}`,
      createdAt: isoNow(-1000 * 60 * (60 - i) - 1000 * 10),
      content: i % 4 === 0 ? veryLargeText.slice(0, 220) : `Question ${i + 1}: ${largeText}`,
      attachments:
        i % 5 === 0
          ? [
              makeAttachment({
                filename: `image-${i + 1}.svg`,
                mimeType: 'image/svg+xml',
                base64Data: base64FromDataUrl(i % 10 === 0 ? largeImageDataUrl : smallImageDataUrl),
              }),
            ]
          : [],
    }),
    assistantTurn: makeAssistantTurn({
      id: `asst-${i + 1}`,
      createdAt: isoNow(-1000 * 60 * (60 - i) + 1000 * 10),
      content: i % 3 === 0 ? flowingMarkdown : largeText,
      charts: hasChart ? [makeChartData({ title: `Chart ${i + 1}` })] : undefined,
      artifacts: hasArtifacts ? makeArtifacts() : [],
      codeOutputs: hasCode ? makeCodeOutputs() : [],
    }),
  })
})
