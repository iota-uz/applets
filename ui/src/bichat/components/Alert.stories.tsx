import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import Alert from './Alert';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof Alert> = {
  title: 'BiChat/Components/Alert',
  component: Alert,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: { type: 'radio' },
      options: ['error', 'success', 'warning', 'info'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>

export const Playground: Story = {
  args: {
    variant: 'info',
    message: 'Operation completed',
    show: true,
    dismissible: true,
    onDismiss: fn(),
  },
};

export const WithTitle: Story = {
  args: {
    variant: 'error',
    title: 'Connection failed',
    message: 'Unable to reach the server. Please check your connection.',
    show: true,
    onDismiss: fn(),
  },
};

export const WithRetry: Story = {
  args: {
    variant: 'warning',
    message: 'Request timed out',
    show: true,
    onRetry: fn(),
    onDismiss: fn(),
  },
};

export const Stress: Story = {
  render: () => {
    const noop = () => {};
    const variants = ['error', 'success', 'warning', 'info'] as const;

    return (
      <ScenarioGrid
        columns={2}
        scenarios={[
          ...variants.map((variant) => ({
            name: `${variant.charAt(0).toUpperCase()}${variant.slice(1)}`,
            content: (
              <div className="w-[480px]">
                <Alert
                  variant={variant}
                  message={`This is a ${variant} alert message.`}
                  show
                  onDismiss={noop}
                />
              </div>
            ),
          })),
          {
            name: 'With Title',
            content: (
              <div className="w-[480px]">
                <Alert
                  variant="error"
                  title="Something went wrong"
                  message="An unexpected error occurred while processing your request. Please try again later."
                  show
                  onDismiss={noop}
                />
              </div>
            ),
          },
          {
            name: 'With Retry',
            content: (
              <div className="w-[480px]">
                <Alert
                  variant="warning"
                  title="Connection lost"
                  message="We are unable to reach the server. Check your internet connection."
                  show
                  onRetry={noop}
                  onDismiss={noop}
                />
              </div>
            ),
          },
          {
            name: 'Not Dismissible',
            content: (
              <div className="w-[480px]">
                <Alert
                  variant="info"
                  message="This alert cannot be dismissed by the user."
                  show
                  dismissible={false}
                />
              </div>
            ),
          },
          {
            name: 'Full Featured',
            content: (
              <div className="w-[480px]">
                <Alert
                  variant="success"
                  title="Upload complete"
                  message="All 12 files have been uploaded successfully."
                  show
                  onRetry={noop}
                  onDismiss={noop}
                />
              </div>
            ),
          },
        ]}
      />
    );
  },
};
