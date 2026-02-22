import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

import Sidebar from './Sidebar'
import { MockChatDataSource } from '@sb-helpers/mockChatDataSource'
import { makeSessions } from '@sb-helpers/bichatFixtures'
import { mobileViewport } from '@sb-helpers/viewportPresets'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const sessions = makeSessions(8)

const meta: Meta<typeof Sidebar> = {
  title: 'BiChat/Components/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof Sidebar>

// ---------------------------------------------------------------------------
// 1. Playground — expanded sidebar with sessions
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    dataSource: new MockChatDataSource({ sessions }),
    onSessionSelect: fn(),
    onNewChat: fn(),
    onArchivedView: fn(),
    activeSessionId: sessions[0].id,
  },
  render: (args) => (
    <div style={{ height: '600px' }}>
      <Sidebar {...args} />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// 2. WithAllChatsTab — showAllChatsTab=true showing org-wide chats
// ---------------------------------------------------------------------------

export const WithAllChatsTab: Story = {
  args: {
    dataSource: new MockChatDataSource({ sessions }),
    onSessionSelect: fn(),
    onNewChat: fn(),
    onArchivedView: fn(),
    activeSessionId: sessions[0].id,
    showAllChatsTab: true,
  },
  render: (args) => (
    <div style={{ height: '600px' }}>
      <Sidebar {...args} />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// 3. Creating — creating=true showing the creating state
// ---------------------------------------------------------------------------

export const Creating: Story = {
  args: {
    dataSource: new MockChatDataSource({ sessions }),
    onSessionSelect: fn(),
    onNewChat: fn(),
    creating: true,
  },
  render: (args) => (
    <div style={{ height: '600px' }}>
      <Sidebar {...args} />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// 4. Empty — no sessions, shows empty state
// ---------------------------------------------------------------------------

export const Empty: Story = {
  args: {
    dataSource: new MockChatDataSource({ sessions: [] }),
    onSessionSelect: fn(),
    onNewChat: fn(),
  },
  render: (args) => (
    <div style={{ height: '600px' }}>
      <Sidebar {...args} />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// 5. MobileDrawer — isOpen=true with mobile viewport
// ---------------------------------------------------------------------------

export const MobileDrawer: Story = {
  parameters: mobileViewport,
  args: {
    dataSource: new MockChatDataSource({ sessions }),
    onSessionSelect: fn(),
    onNewChat: fn(),
    onClose: fn(),
    isOpen: true,
    activeSessionId: sessions[0].id,
  },
  render: (args) => (
    <div style={{ height: '600px' }}>
      <Sidebar {...args} />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// 6. Stress — ScenarioGrid with multiple variants
// ---------------------------------------------------------------------------

export const Stress: Story = {
  render: () => {
    const noop = () => {}
    return (
      <ScenarioGrid
        columns={2}
        scenarios={[
          {
            name: 'Default',
            description: 'Expanded sidebar with sessions',
            content: (
              <div style={{ height: '500px' }}>
                <Sidebar
                  dataSource={new MockChatDataSource({ sessions })}
                  onSessionSelect={noop}
                  onNewChat={noop}
                  onArchivedView={noop}
                  activeSessionId={sessions[0].id}
                />
              </div>
            ),
          },
          {
            name: 'Empty',
            description: 'No sessions available',
            content: (
              <div style={{ height: '500px' }}>
                <Sidebar
                  dataSource={new MockChatDataSource({ sessions: [] })}
                  onSessionSelect={noop}
                  onNewChat={noop}
                />
              </div>
            ),
          },
          {
            name: 'Creating',
            description: 'New chat being created',
            content: (
              <div style={{ height: '500px' }}>
                <Sidebar
                  dataSource={new MockChatDataSource({ sessions })}
                  onSessionSelect={noop}
                  onNewChat={noop}
                  creating={true}
                />
              </div>
            ),
          },
          {
            name: 'All Chats Tab',
            description: 'showAllChatsTab enabled',
            content: (
              <div style={{ height: '500px' }}>
                <Sidebar
                  dataSource={new MockChatDataSource({ sessions })}
                  onSessionSelect={noop}
                  onNewChat={noop}
                  onArchivedView={noop}
                  showAllChatsTab={true}
                  activeSessionId={sessions[1].id}
                />
              </div>
            ),
          },
        ]}
      />
    )
  },
}
