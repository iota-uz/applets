import type { Meta, StoryObj } from '@storybook/react';

import ScreenReaderAnnouncer from './ScreenReaderAnnouncer';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof ScreenReaderAnnouncer> = {
  title: 'BiChat/Components/ScreenReaderAnnouncer',
  component: ScreenReaderAnnouncer,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ScreenReaderAnnouncer>

const InfoBox = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="w-[360px] space-y-3">
    {children}
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
      <p className="font-medium mb-1">ScreenReaderAnnouncer is rendered</p>
      <p>
        This component uses an ARIA live region (<code>sr-only</code>) to announce
        messages to screen readers. It is visually hidden but present in the DOM.
      </p>
      <p className="mt-2 text-xs text-blue-500 dark:text-blue-400">{label}</p>
    </div>
  </div>
);

export const Polite: Story = {
  args: {
    message: 'New message received from assistant',
    politeness: 'polite',
  },
  render: (args) => (
    <InfoBox label={`Politeness: ${args.politeness} — waits for user pause`}>
      <ScreenReaderAnnouncer {...args} />
    </InfoBox>
  ),
};

export const Assertive: Story = {
  args: {
    message: 'Error: connection lost. Retrying...',
    politeness: 'assertive',
  },
  render: (args) => (
    <InfoBox label={`Politeness: ${args.politeness} — interrupts immediately`}>
      <ScreenReaderAnnouncer {...args} />
    </InfoBox>
  ),
};

export const WithClearAfter: Story = {
  args: {
    message: 'Message sent successfully',
    politeness: 'polite',
    clearAfter: 3000,
  },
  render: (args) => (
    <InfoBox label={`clearAfter: ${args.clearAfter}ms — announcement clears after delay`}>
      <ScreenReaderAnnouncer {...args} />
    </InfoBox>
  ),
};

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Polite — waits for user idle',
          content: (
            <InfoBox label="polite">
              <ScreenReaderAnnouncer message="New message received" politeness="polite" />
            </InfoBox>
          ),
        },
        {
          name: 'Assertive — interrupts screen reader',
          content: (
            <InfoBox label="assertive">
              <ScreenReaderAnnouncer message="Connection error!" politeness="assertive" />
            </InfoBox>
          ),
        },
        {
          name: 'Auto-clear after 3s',
          content: (
            <InfoBox label="clearAfter: 3000">
              <ScreenReaderAnnouncer message="Temporary notification" politeness="polite" clearAfter={3000} />
            </InfoBox>
          ),
        },
        {
          name: 'Empty message (no announcement)',
          content: (
            <InfoBox label="empty message">
              <ScreenReaderAnnouncer message="" politeness="polite" />
            </InfoBox>
          ),
        },
      ]}
    />
  ),
};
