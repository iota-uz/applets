import type { Meta, StoryObj } from '@storybook/react'
import { MagnifyingGlass, FolderOpen, ChatCircleDots } from '@phosphor-icons/react'

import { EmptyState } from './EmptyState'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof EmptyState> = {
  title: 'BiChat/Components/EmptyState',
  component: EmptyState,
  parameters: { layout: 'centered' },
  argTypes: {
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const Playground: Story = {
  args: {
    title: 'No results found',
    description: 'Try adjusting your search',
  },
}

export const WithAction: Story = {
  args: {
    title: 'No conversations yet',
    description: 'Start a new conversation to get going.',
    icon: <ChatCircleDots size={48} className="text-gray-300" />,
    action: (
      <button className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">
        Create new
      </button>
    ),
  },
}

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Small',
          content: (
            <EmptyState
              size="sm"
              title="No items"
              description="Nothing to show here."
            />
          ),
        },
        {
          name: 'Medium (default)',
          content: (
            <EmptyState
              size="md"
              title="No results found"
              description="Try adjusting your search or filters."
            />
          ),
        },
        {
          name: 'Large',
          content: (
            <EmptyState
              size="lg"
              title="Welcome to BiChat"
              description="Start a conversation to explore your data."
            />
          ),
        },
        {
          name: 'With Icon',
          content: (
            <EmptyState
              title="No search results"
              description="We could not find anything matching your query."
              icon={<MagnifyingGlass size={48} className="text-gray-300" />}
            />
          ),
        },
        {
          name: 'With Action',
          content: (
            <EmptyState
              title="Folder is empty"
              description="Upload files to get started."
              icon={<FolderOpen size={48} className="text-gray-300" />}
              action={
                <button className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">
                  Upload files
                </button>
              }
            />
          ),
        },
        {
          name: 'Title Only (minimal)',
          content: <EmptyState title="Nothing here" />,
        },
      ]}
    />
  ),
}
