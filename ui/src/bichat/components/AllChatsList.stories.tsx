import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import AllChatsList from './AllChatsList';
import { MockChatDataSource } from '@sb-helpers/mockChatDataSource';
import { makeSessions } from '@sb-helpers/bichatFixtures';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const sessions = makeSessions(8);

const meta: Meta<typeof AllChatsList> = {
  title: 'BiChat/Components/AllChatsList',
  component: AllChatsList,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof AllChatsList>

// ---------------------------------------------------------------------------
// 1. Playground — default with populated sessions and users
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    dataSource: new MockChatDataSource({ sessions }),
    onSessionSelect: fn(),
    activeSessionId: sessions[0].id,
  },
  render: (args) => (
    <div className="w-64">
      <AllChatsList {...args} />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// 2. Empty — no sessions available
// ---------------------------------------------------------------------------

export const Empty: Story = {
  args: {
    dataSource: new MockChatDataSource({ sessions: [] }),
    onSessionSelect: fn(),
  },
  render: (args) => (
    <div className="w-64">
      <AllChatsList {...args} />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// 3. Stress — ScenarioGrid with multiple variants
// ---------------------------------------------------------------------------

export const Stress: Story = {
  render: () => {
    const noop = () => {};
    return (
      <ScenarioGrid
        columns={2}
        scenarios={[
          {
            name: 'With Sessions',
            description: 'Populated session list with users',
            content: (
              <div className="w-64">
                <AllChatsList
                  dataSource={new MockChatDataSource({ sessions })}
                  onSessionSelect={noop}
                  activeSessionId={sessions[0].id}
                />
              </div>
            ),
          },
          {
            name: 'Empty',
            description: 'No sessions available',
            content: (
              <div className="w-64">
                <AllChatsList
                  dataSource={new MockChatDataSource({ sessions: [] })}
                  onSessionSelect={noop}
                />
              </div>
            ),
          },
          {
            name: 'Many Sessions',
            description: 'Large list to test scroll and pagination',
            content: (
              <div className="w-64" style={{ height: '400px' }}>
                <AllChatsList
                  dataSource={new MockChatDataSource({ sessions: makeSessions(30) })}
                  onSessionSelect={noop}
                  activeSessionId="session-5"
                />
              </div>
            ),
          },
        ]}
      />
    );
  },
};
