import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import AttachmentUpload from './AttachmentUpload';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof AttachmentUpload> = {
  title: 'BiChat/Components/AttachmentUpload',
  component: AttachmentUpload,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof AttachmentUpload>

export const Playground: Story = {
  args: {
    onAttachmentsSelected: fn(),
  },
};

export const Stress: Story = {
  render: () => {
    const noop = fn();
    return (
      <ScenarioGrid
        columns={3}
        scenarios={[
          {
            name: 'Default (enabled)',
            content: <AttachmentUpload onAttachmentsSelected={noop} />,
          },
          {
            name: 'Disabled',
            content: <AttachmentUpload onAttachmentsSelected={noop} disabled />,
          },
          {
            name: 'Custom limits (max 2 files, 1MB)',
            content: (
              <AttachmentUpload
                onAttachmentsSelected={noop}
                maxAttachments={2}
                maxSizeBytes={1024 * 1024}
              />
            ),
          },
        ]}
      />
    );
  },
};
