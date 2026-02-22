import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

import { ToastContainer } from './ToastContainer'
const meta: Meta<typeof ToastContainer> = {
  title: 'BiChat/Components/ToastContainer',
  component: ToastContainer,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof ToastContainer>

export const Playground: Story = {
  args: {
    toasts: [
      { id: '1', type: 'success', message: 'Session saved.' },
      { id: '2', type: 'error', message: 'Failed to load conversation history.' },
    ],
    onDismiss: fn(),
  },
}

export const AllVariants: Story = {
  args: {
    toasts: [
      { id: '1', type: 'success', message: 'Changes saved successfully.' },
      { id: '2', type: 'error', message: 'Failed to send message. Please try again.' },
      { id: '3', type: 'info', message: 'A new version of the assistant is available.' },
      { id: '4', type: 'warning', message: 'You are approaching the usage limit for this session.' },
    ],
    onDismiss: fn(),
  },
}

export const ManyToasts: Story = {
  args: {
    toasts: [
      { id: '1', type: 'success', message: 'File uploaded: report.xlsx' },
      { id: '2', type: 'info', message: 'Processing your request...' },
      { id: '3', type: 'warning', message: 'Session will expire in 5 minutes.' },
      { id: '4', type: 'error', message: 'Connection lost. Reconnecting...' },
      { id: '5', type: 'success', message: 'Connection restored.' },
      { id: '6', type: 'info', message: '3 new messages from assistant.' },
    ],
    onDismiss: fn(),
  },
}

export const LongMessages: Story = {
  args: {
    toasts: [
      {
        id: '1',
        type: 'error',
        message: 'The request to the AI model timed out after 30 seconds. This may be due to high server load. Please check your network connection and try again.',
      },
      {
        id: '2',
        type: 'warning',
        message: 'Your current plan allows up to 100 messages per day. You have used 94 messages today. Consider upgrading to continue without interruption.',
      },
    ],
    onDismiss: fn(),
  },
}

export const CustomDismissLabel: Story = {
  args: {
    toasts: [
      { id: '1', type: 'info', message: 'Custom dismiss label on button.' },
    ],
    onDismiss: fn(),
    dismissLabel: 'Close notification',
  },
}

export const Empty: Story = {
  args: {
    toasts: [],
    onDismiss: fn(),
  },
}
