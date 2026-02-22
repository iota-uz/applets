import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { TabBar } from './TabBar';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof TabBar> = {
  title: 'BiChat/Components/TabBar',
  component: TabBar,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TabBar>

const threeTabs = [
  { id: 'my-chats', label: 'My Chats' },
  { id: 'all-chats', label: 'All Chats' },
  { id: 'archives', label: 'Archives' },
];

const twoTabs = [
  { id: 'my-chats', label: 'My Chats' },
  { id: 'archives', label: 'Archives' },
];

const sixTabs = [
  { id: 'my-chats', label: 'My Chats' },
  { id: 'all-chats', label: 'All Chats' },
  { id: 'archives', label: 'Archives' },
  { id: 'starred', label: 'Starred' },
  { id: 'shared', label: 'Shared' },
  { id: 'drafts', label: 'Drafts' },
];

// ---------------------------------------------------------------------------
// 1. Playground — interactive with 3 tabs
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    tabs: threeTabs,
    activeTab: 'my-chats',
    onTabChange: fn(),
  },
};

// ---------------------------------------------------------------------------
// 2. TwoTabs — minimal tab set
// ---------------------------------------------------------------------------

export const TwoTabs: Story = {
  args: {
    tabs: twoTabs,
    activeTab: 'my-chats',
    onTabChange: fn(),
  },
};

// ---------------------------------------------------------------------------
// 3. ManyTabs — 6 tabs to test overflow
// ---------------------------------------------------------------------------

export const ManyTabs: Story = {
  args: {
    tabs: sixTabs,
    activeTab: 'my-chats',
    onTabChange: fn(),
  },
};

// ---------------------------------------------------------------------------
// 4. Stress — ScenarioGrid covering tab counts
// ---------------------------------------------------------------------------

export const Stress: Story = {
  decorators: [
    (Story) => (
      <div className="w-[42rem]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: '2 Tabs',
          description: 'Minimal tab set',
          content: (
            <div className="w-80">
              <TabBar
                tabs={twoTabs}
                activeTab="my-chats"
                onTabChange={fn()}
              />
            </div>
          ),
        },
        {
          name: '3 Tabs',
          description: 'Standard tab set',
          content: (
            <div className="w-80">
              <TabBar
                tabs={threeTabs}
                activeTab="all-chats"
                onTabChange={fn()}
              />
            </div>
          ),
        },
        {
          name: '6 Tabs',
          description: 'Many tabs to test overflow',
          content: (
            <div className="w-80">
              <TabBar
                tabs={sixTabs}
                activeTab="starred"
                onTabChange={fn()}
              />
            </div>
          ),
        },
      ]}
    />
  ),
};
