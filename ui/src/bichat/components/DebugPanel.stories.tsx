import type { Meta, StoryObj } from '@storybook/react'

import { DebugPanel } from './DebugPanel'
import type { DebugTrace } from '../types'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof DebugPanel> = {
  title: 'BiChat/Components/DebugPanel',
  component: DebugPanel,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof DebugPanel>

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[480px] bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
    {children}
  </div>
)

const fullTrace: DebugTrace = {
  generationMs: 2340,
  usage: {
    promptTokens: 1250,
    completionTokens: 480,
    totalTokens: 1730,
    cachedTokens: 312,
  },
  tools: [
    {
      callId: 'call_001',
      name: 'search_documents',
      arguments: JSON.stringify({ query: 'quarterly revenue', limit: 10 }, null, 2),
      result: JSON.stringify({ documents: [{ id: 1, title: 'Q3 Report' }] }, null, 2),
      durationMs: 187,
    },
    {
      callId: 'call_002',
      name: 'run_sql_query',
      arguments: JSON.stringify({ sql: 'SELECT * FROM sales WHERE quarter = 3' }, null, 2),
      error: 'relation "sales" does not exist',
      durationMs: 42,
    },
    {
      callId: 'call_003',
      name: 'generate_chart',
      arguments: JSON.stringify({ type: 'bar', data: [10, 20, 30] }, null, 2),
      result: JSON.stringify({ chartUrl: '/charts/abc123.png' }),
      durationMs: 560,
    },
  ],
}

const metricsOnlyTrace: DebugTrace = {
  generationMs: 890,
  usage: {
    promptTokens: 3200,
    completionTokens: 1100,
    totalTokens: 4300,
    cachedTokens: 0,
  },
  tools: [],
}

const highVolumeTrace: DebugTrace = {
  generationMs: 18_500,
  usage: {
    promptTokens: 128_000,
    completionTokens: 4_096,
    totalTokens: 132_096,
    cachedTokens: 96_000,
  },
  tools: [
    { callId: 'c1', name: 'vector_search', arguments: '{"query":"..."}', result: '{"hits":250}', durationMs: 1200 },
    { callId: 'c2', name: 'run_sql_query', arguments: '{"sql":"SELECT ..."}', result: '{"rows":1500}', durationMs: 3400 },
    { callId: 'c3', name: 'calculate_metrics', arguments: '{"fn":"aggregate"}', result: '{"revenue":2300000}', durationMs: 200 },
    { callId: 'c4', name: 'generate_report', arguments: '{"format":"xlsx"}', durationMs: undefined },
    { callId: 'c5', name: 'send_notification', arguments: '{}', error: 'SMTP connection refused', durationMs: 5020 },
  ],
}

const allErrorsTrace: DebugTrace = {
  generationMs: 340,
  usage: {
    promptTokens: 500,
    completionTokens: 20,
    totalTokens: 520,
    cachedTokens: 0,
  },
  tools: [
    { callId: 'e1', name: 'fetch_user', arguments: '{"id":99}', error: 'User not found (404)', durationMs: 80 },
    { callId: 'e2', name: 'update_record', arguments: '{"id":1}', error: 'Permission denied: insufficient role', durationMs: 15 },
  ],
}

export const Playground: Story = {
  args: { trace: fullTrace },
  render: (args) => (
    <Wrapper>
      <DebugPanel trace={args.trace} />
    </Wrapper>
  ),
}

export const MetricsOnly: Story = {
  render: () => (
    <Wrapper>
      <DebugPanel trace={metricsOnlyTrace} />
    </Wrapper>
  ),
}

export const HighVolume: Story = {
  render: () => (
    <Wrapper>
      <DebugPanel trace={highVolumeTrace} />
    </Wrapper>
  ),
}

export const AllToolErrors: Story = {
  render: () => (
    <Wrapper>
      <DebugPanel trace={allErrorsTrace} />
    </Wrapper>
  ),
}

export const Empty: Story = {
  render: () => (
    <Wrapper>
      <DebugPanel trace={undefined} />
    </Wrapper>
  ),
}

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Full trace — metrics + mixed tool results',
          content: (
            <Wrapper>
              <DebugPanel trace={fullTrace} />
            </Wrapper>
          ),
        },
        {
          name: 'Metrics only — no tool calls',
          content: (
            <Wrapper>
              <DebugPanel trace={metricsOnlyTrace} />
            </Wrapper>
          ),
        },
        {
          name: 'High volume — 128K tokens, 5 tools, cached',
          content: (
            <Wrapper>
              <DebugPanel trace={highVolumeTrace} />
            </Wrapper>
          ),
        },
        {
          name: 'All tool errors — red status indicators',
          content: (
            <Wrapper>
              <DebugPanel trace={allErrorsTrace} />
            </Wrapper>
          ),
        },
        {
          name: 'No trace data — empty state',
          content: (
            <Wrapper>
              <DebugPanel trace={undefined} />
            </Wrapper>
          ),
        },
        {
          name: 'Pending tool (no result or error)',
          content: (
            <Wrapper>
              <DebugPanel
                trace={{
                  generationMs: undefined,
                  tools: [{ callId: 'p1', name: 'long_running_analysis', arguments: '{"dataset":"full"}' }],
                }}
              />
            </Wrapper>
          ),
        },
      ]}
    />
  ),
}
