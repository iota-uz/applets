import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

import ArchivedChatList from './ArchivedChatList'
import { MockChatDataSource } from '@sb-helpers/mockChatDataSource'
import { makeSessions } from '@sb-helpers/bichatFixtures'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const archivedSessions = makeSessions(5).map(s => ({ ...s, status: 'archived' as const }))

const meta: Meta<typeof ArchivedChatList> = {
  title: 'BiChat/Components/ArchivedChatList',
  component: ArchivedChatList,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof ArchivedChatList>

// ---------------------------------------------------------------------------
// 1. Playground — with archived sessions
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    dataSource: new MockChatDataSource({ sessions: archivedSessions }),
    onBack: fn(),
    onSessionSelect: fn(),
    activeSessionId: archivedSessions[0].id,
  },
  render: (args) => (
    <div style={{ height: '600px', width: '320px' }}>
      <ArchivedChatList {...args} />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// 2. Empty — no archived sessions
// ---------------------------------------------------------------------------

export const Empty: Story = {
  args: {
    dataSource: new MockChatDataSource({ sessions: [] }),
    onBack: fn(),
    onSessionSelect: fn(),
  },
  render: (args) => (
    <div style={{ height: '600px', width: '320px' }}>
      <ArchivedChatList {...args} />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// 3. Stress — ScenarioGrid with multiple variants
// ---------------------------------------------------------------------------

export const Stress: Story = {
  render: () => {
    const noop = () => {}
    const manyArchived = makeSessions(15).map(s => ({ ...s, status: 'archived' as const }))
    return (
      <ScenarioGrid
        columns={2}
        scenarios={[
          {
            name: 'With Archived Sessions',
            description: '5 archived chats with active selection',
            content: (
              <div style={{ height: '500px', width: '320px' }}>
                <ArchivedChatList
                  dataSource={new MockChatDataSource({ sessions: archivedSessions })}
                  onBack={noop}
                  onSessionSelect={noop}
                  activeSessionId={archivedSessions[0].id}
                />
              </div>
            ),
          },
          {
            name: 'Empty',
            description: 'No archived sessions',
            content: (
              <div style={{ height: '500px', width: '320px' }}>
                <ArchivedChatList
                  dataSource={new MockChatDataSource({ sessions: [] })}
                  onBack={noop}
                  onSessionSelect={noop}
                />
              </div>
            ),
          },
          {
            name: 'Many Archived',
            description: '15 archived sessions to test scrolling',
            content: (
              <div style={{ height: '500px', width: '320px' }}>
                <ArchivedChatList
                  dataSource={new MockChatDataSource({ sessions: manyArchived })}
                  onBack={noop}
                  onSessionSelect={noop}
                  activeSessionId="session-3"
                />
              </div>
            ),
          },
        ]}
      />
    )
  },
}
