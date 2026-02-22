import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { RetryActionArea } from './RetryActionArea';

const meta: Meta<typeof RetryActionArea> = {
  title: 'BiChat/Components/RetryActionArea',
  component: RetryActionArea,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof RetryActionArea>

export const Default: Story = {
  args: {
    onRetry: fn(),
  },
};

export const InChatContext: Story = {
  render: () => (
    <div className="max-w-md space-y-3 p-4">
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
        Something went wrong while generating a response. The server returned a 503 error.
      </div>
      <RetryActionArea onRetry={fn()} />
    </div>
  ),
};
