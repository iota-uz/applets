import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { MessageQueueList } from './MessageQueueList';
import type { QueuedMessage } from '../types';

const meta: Meta<typeof MessageQueueList> = {
  title: 'BiChat/Components/MessageQueueList',
  component: MessageQueueList,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MessageQueueList>

const queuedMessages: QueuedMessage[] = [
  { content: 'Show me the revenue breakdown by region', attachments: [] },
  { content: 'Also include the customer churn analysis', attachments: [] },
  {
    content: 'Compare with last quarter results',
    attachments: [
      {
        clientKey: 'att-1',
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 204800,
      },
    ],
  },
];

export const Playground: Story = {
  args: {
    queue: queuedMessages,
    onRemove: fn(),
    onUpdate: fn(),
  },
};

export const SingleMessage: Story = {
  args: {
    queue: [queuedMessages[0]],
    onRemove: fn(),
    onUpdate: fn(),
  },
};

export const Empty: Story = {
  args: {
    queue: [],
    onRemove: fn(),
    onUpdate: fn(),
  },
};
