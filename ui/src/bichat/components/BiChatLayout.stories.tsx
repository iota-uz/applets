import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { BiChatLayout } from './BiChatLayout';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';
import { mobileViewport, tabletViewport } from '@sb-helpers/viewportPresets';

const meta: Meta<typeof BiChatLayout> = {
  title: 'BiChat/Components/BiChatLayout',
  component: BiChatLayout,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof BiChatLayout>

const SampleSidebar = () => (
  <div className="flex h-full flex-col bg-white p-4 dark:bg-gray-800">
    <div className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">Sidebar</div>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="mb-2 rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        Session {i + 1}
      </div>
    ))}
  </div>
);

const SampleContent = () => (
  <div className="flex h-full items-center justify-center">
    <p className="text-gray-500 dark:text-gray-400">Main content area</p>
  </div>
);

const HeavyContent = () => (
  <div className="flex flex-col h-full p-6 overflow-auto">
    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Conversation</h2>
    {Array.from({ length: 20 }).map((_, i) => (
      <div
        key={i}
        className={`mb-3 max-w-md rounded-lg px-4 py-2 text-sm ${
          i % 2 === 0
            ? 'self-end bg-primary-100 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100'
            : 'self-start bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}
      >
        {i % 2 === 0 ? `User message ${Math.ceil((i + 1) / 2)}` : `Assistant response ${Math.ceil((i + 1) / 2)} — here is some longer text to test wrapping and layout.`}
      </div>
    ))}
  </div>
);

export const Playground: Story = {
  args: {
    renderSidebar: () => <SampleSidebar />,
    children: <SampleContent />,
    onNewChat: fn(),
  },
};

export const WithRouteTransitions: Story = {
  args: {
    renderSidebar: () => <SampleSidebar />,
    children: <SampleContent />,
    routeKey: '/chat/session-1',
    onNewChat: fn(),
  },
};

export const MobileViewport: Story = {
  parameters: mobileViewport,
  args: {
    renderSidebar: () => <SampleSidebar />,
    children: <SampleContent />,
    onNewChat: fn(),
  },
};

export const TabletViewport: Story = {
  parameters: tabletViewport,
  args: {
    renderSidebar: () => <SampleSidebar />,
    children: <HeavyContent />,
    onNewChat: fn(),
  },
};

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={1}
      scenarios={[
        {
          name: 'Default — sidebar + minimal content',
          content: (
            <div style={{ height: 400 }}>
              <BiChatLayout renderSidebar={() => <SampleSidebar />} onNewChat={fn()}>
                <SampleContent />
              </BiChatLayout>
            </div>
          ),
        },
        {
          name: 'Heavy content — many messages with scroll',
          content: (
            <div style={{ height: 400 }}>
              <BiChatLayout renderSidebar={() => <SampleSidebar />} onNewChat={fn()}>
                <HeavyContent />
              </BiChatLayout>
            </div>
          ),
        },
        {
          name: 'Custom class — extra padding',
          content: (
            <div style={{ height: 400 }}>
              <BiChatLayout renderSidebar={() => <SampleSidebar />} className="p-2 bg-gray-50 dark:bg-gray-950" onNewChat={fn()}>
                <SampleContent />
              </BiChatLayout>
            </div>
          ),
        },
      ]}
    />
  ),
};
