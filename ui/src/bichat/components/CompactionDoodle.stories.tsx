import type { Meta, StoryObj } from '@storybook/react';

import { CompactionDoodle } from './CompactionDoodle';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof CompactionDoodle> = {
  title: 'BiChat/Components/CompactionDoodle',
  component: CompactionDoodle,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof CompactionDoodle>

export const Playground: Story = {
  args: {
    title: 'Compacting conversation',
    subtitle: 'summarising older messages...',
  },
};

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={1}
      scenarios={[
        {
          name: 'In-progress compaction (animated ping dot)',
          content: <CompactionDoodle title="Compacting conversation" subtitle="summarising older messages..." />,
        },
        {
          name: 'Completed compaction',
          content: <CompactionDoodle title="Summary ready" subtitle="24 messages compacted into 1 summary" />,
        },
        {
          name: 'Long text (wrapping behaviour)',
          content: (
            <div style={{ maxWidth: 320 }}>
              <CompactionDoodle
                title="Compacting a very long conversation history"
                subtitle="this subtitle is deliberately long to test text wrapping and layout behaviour at narrow widths"
              />
            </div>
          ),
        },
        {
          name: 'Minimal text',
          content: <CompactionDoodle title="Working" subtitle="..." />,
        },
      ]}
    />
  ),
};
