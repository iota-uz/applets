import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

import { Toast } from './Toast'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof Toast> = {
  title: 'BiChat/Components/Toast',
  component: Toast,
  parameters: { layout: 'centered' },
  argTypes: {
    type: {
      control: { type: 'radio' },
      options: ['success', 'error', 'info', 'warning'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Toast>

export const Playground: Story = {
  args: {
    id: 'toast-1',
    type: 'success',
    message: 'Operation completed successfully.',
    duration: 60_000,
    onDismiss: fn(),
  },
}

export const Stress: Story = {
  render: () => {
    const noop = () => {}
    return (
      <ScenarioGrid
        scenarios={[
          {
            name: 'Success',
            content: (
              <Toast
                id="s"
                type="success"
                message="Changes saved successfully."
                duration={120_000}
                onDismiss={noop}
              />
            ),
          },
          {
            name: 'Error',
            content: (
              <Toast
                id="e"
                type="error"
                message="Failed to send message. Please try again."
                duration={120_000}
                onDismiss={noop}
              />
            ),
          },
          {
            name: 'Info',
            content: (
              <Toast
                id="i"
                type="info"
                message="A new version of the assistant is available."
                duration={120_000}
                onDismiss={noop}
              />
            ),
          },
          {
            name: 'Warning',
            content: (
              <Toast
                id="w"
                type="warning"
                message="You are approaching the usage limit for this session."
                duration={120_000}
                onDismiss={noop}
              />
            ),
          },
        ]}
      />
    )
  },
}
