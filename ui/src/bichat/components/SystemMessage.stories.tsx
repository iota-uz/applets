import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

import { SystemMessage } from './SystemMessage'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof SystemMessage> = {
  title: 'BiChat/Components/SystemMessage',
  component: SystemMessage,
  parameters: { layout: 'centered' },
  argTypes: {
    hideActions: { control: { type: 'boolean' } },
    hideTimestamp: { control: { type: 'boolean' } },
  },
}

export default meta
type Story = StoryObj<typeof SystemMessage>

export const Playground: Story = {
  args: {
    content:
      'The user asked about quarterly revenue trends. Key points discussed: Q1 showed 12% growth, Q2 was flat, and Q3 projections look positive based on current pipeline.',
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    onCopy: fn(),
  },
}

export const LongContent: Story = {
  args: {
    content: [
      '## Conversation Summary',
      '',
      'The discussion covered several topics over multiple exchanges:',
      '',
      '1. **Data ingestion pipeline** -- the user requested a review of the current ETL process, identifying bottlenecks in the transformation stage.',
      '2. **Performance optimisation** -- we explored indexing strategies for PostgreSQL, including partial indexes and BRIN indexes for time-series data.',
      '3. **Architecture decisions** -- the team is considering a move from a monolithic backend to a service-oriented approach, weighing trade-offs around operational complexity versus independent deployability.',
      '4. **Testing strategy** -- integration tests were discussed as a priority, with a recommendation to adopt contract testing for service boundaries.',
      '5. **Deployment** -- a blue-green deployment model was proposed to reduce downtime during releases.',
      '',
      'Next steps include drafting an RFC for the service decomposition and benchmarking the proposed index changes against the staging dataset.',
    ].join('\n'),
    createdAt: new Date(Date.now() - 86400_000).toISOString(),
    onCopy: fn(),
  },
}

export const Stress: Story = {
  render: () => {
    const noop = fn()
    const now = new Date().toISOString()
    return (
      <ScenarioGrid
        scenarios={[
          {
            name: 'Default',
            content: (
              <SystemMessage
                content="Short summary of what was discussed."
                createdAt={now}
                onCopy={noop}
              />
            ),
          },
          {
            name: 'Hidden actions',
            content: (
              <SystemMessage
                content="Summary with no action buttons visible."
                createdAt={now}
                hideActions
              />
            ),
          },
          {
            name: 'Hidden timestamp',
            content: (
              <SystemMessage
                content="Summary without a timestamp shown."
                createdAt={now}
                onCopy={noop}
                hideTimestamp
              />
            ),
          },
          {
            name: 'Minimal (no copy handler)',
            content: (
              <SystemMessage
                content="Minimal summary relying on native clipboard."
                createdAt={now}
              />
            ),
          },
        ]}
      />
    )
  },
}
