import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { StreamError } from './StreamError';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof StreamError> = {
  title: 'BiChat/Components/StreamError',
  component: StreamError,
  parameters: { layout: 'centered' },
  argTypes: {
    compact: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof StreamError>

export const Playground: Story = {
  args: {
    error: 'Connection lost while streaming response. Please try again.',
    onRetry: fn(),
    onRegenerate: fn(),
    onDismiss: fn(),
  },
};

export const NonRetryable: Story = {
  args: {
    error: 'This model is currently unavailable. Please select a different model.',
  },
};

export const Stress: Story = {
  render: () => {
    const noop = () => {};
    return (
      <ScenarioGrid
        scenarios={[
          {
            name: 'All actions',
            content: (
              <StreamError
                error="Network timeout while streaming."
                onRetry={noop}
                onRegenerate={noop}
                onDismiss={noop}
              />
            ),
          },
          {
            name: 'Retry only',
            content: (
              <StreamError
                error="Server returned an error. Retrying may help."
                onRetry={noop}
              />
            ),
          },
          {
            name: 'Regenerate only',
            content: (
              <StreamError
                error="The response was incomplete."
                onRegenerate={noop}
              />
            ),
          },
          {
            name: 'No actions',
            content: (
              <StreamError error="Fatal error: model not found." />
            ),
          },
          {
            name: 'Compact mode',
            content: (
              <StreamError
                error="Stream interrupted."
                onRetry={noop}
                onDismiss={noop}
                compact
              />
            ),
          },
          {
            name: 'Long error message',
            content: (
              <StreamError
                error="An unexpected error occurred while processing your request. The upstream service returned HTTP 503 Service Unavailable with the following details: the inference cluster is currently at capacity and cannot accept new requests. Please wait a few moments and try again. If the problem persists, contact your administrator."
                onRetry={noop}
                onRegenerate={noop}
                onDismiss={noop}
              />
            ),
          },
        ]}
      />
    );
  },
};
