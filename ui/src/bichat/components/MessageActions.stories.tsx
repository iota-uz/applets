import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

import { MessageActions } from './MessageActions'
import { MessageRole } from '../types'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof MessageActions> = {
  title: 'BiChat/Components/MessageActions',
  component: MessageActions,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof MessageActions>

const assistantMessage = {
  id: 'msg-1',
  role: MessageRole.Assistant,
  content: 'Based on the Q4 revenue data, sales increased by 12% compared to Q3.',
}

const userMessage = {
  id: 'msg-2',
  role: MessageRole.User,
  content: 'Show me the quarterly revenue breakdown for 2025.',
}

// ---------------------------------------------------------------------------
// 1. AssistantMessage — copy + regenerate actions
// ---------------------------------------------------------------------------

export const AssistantMessage: Story = {
  args: {
    message: assistantMessage,
    onCopy: fn(),
    onRegenerate: fn(),
  },
}

// ---------------------------------------------------------------------------
// 2. UserMessage — copy + edit actions
// ---------------------------------------------------------------------------

export const UserMessage: Story = {
  args: {
    message: userMessage,
    onCopy: fn(),
    onEdit: fn(),
  },
}

// ---------------------------------------------------------------------------
// 3. CopyOnly — assistant message with no regenerate
// ---------------------------------------------------------------------------

export const CopyOnly: Story = {
  args: {
    message: assistantMessage,
    onCopy: fn(),
  },
}

// ---------------------------------------------------------------------------
// 4. Stress — ScenarioGrid covering action combinations
// ---------------------------------------------------------------------------

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Assistant (Copy + Regenerate)',
          description: 'Full assistant action set',
          content: (
            <MessageActions
              message={assistantMessage}
              onCopy={fn()}
              onRegenerate={fn()}
            />
          ),
        },
        {
          name: 'User (Copy + Edit)',
          description: 'Full user action set',
          content: (
            <MessageActions
              message={userMessage}
              onCopy={fn()}
              onEdit={fn()}
            />
          ),
        },
        {
          name: 'Copy Only',
          description: 'Assistant message, no regenerate callback',
          content: (
            <MessageActions
              message={assistantMessage}
              onCopy={fn()}
            />
          ),
        },
      ]}
    />
  ),
}
