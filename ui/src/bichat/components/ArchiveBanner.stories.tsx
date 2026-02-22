import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import ArchiveBanner from './ArchiveBanner';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof ArchiveBanner> = {
  title: 'BiChat/Components/ArchiveBanner',
  component: ArchiveBanner,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ArchiveBanner>

export const Default: Story = {
  args: {
    show: true,
    onRestore: fn(),
    restoring: false,
  },
};

export const Stress: Story = {
  render: () => {
    const noop = async () => {};
    return (
      <ScenarioGrid
        scenarios={[
          {
            name: 'Visible',
            content: (
              <ArchiveBanner
                show={true}
                onRestore={noop}
              />
            ),
          },
          {
            name: 'Restoring',
            content: (
              <ArchiveBanner
                show={true}
                onRestore={noop}
                restoring={true}
              />
            ),
          },
          {
            name: 'Hidden',
            content: (
              <ArchiveBanner
                show={false}
                onRestore={noop}
              />
            ),
          },
        ]}
      />
    );
  },
};
