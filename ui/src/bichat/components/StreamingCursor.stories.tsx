import type { Meta, StoryObj } from '@storybook/react'

import { StreamingCursor } from './StreamingCursor'

const meta: Meta<typeof StreamingCursor> = {
  title: 'BiChat/Components/StreamingCursor',
  component: StreamingCursor,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof StreamingCursor>

export const Default: Story = {}

export const InParagraph: Story = {
  render: () => (
    <p className="max-w-md text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
      The Q4 revenue was $2.3M, representing a 15% increase over Q3. Key growth drivers included
      <StreamingCursor />
    </p>
  ),
}

export const InHeading: Story = {
  render: () => (
    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
      Analysing your data
      <StreamingCursor />
    </h2>
  ),
}
