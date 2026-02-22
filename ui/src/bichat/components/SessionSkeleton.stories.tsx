import type { Meta, StoryObj } from '@storybook/react'

import SessionSkeleton from './SessionSkeleton'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof SessionSkeleton> = {
  title: 'BiChat/Components/SessionSkeleton',
  component: SessionSkeleton,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof SessionSkeleton>

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <SessionSkeleton />
    </div>
  ),
}

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={3}
      scenarios={[
        {
          name: 'Single item (count=1)',
          content: (
            <div className="w-56">
              <SessionSkeleton count={1} />
            </div>
          ),
        },
        {
          name: 'Default (count=5)',
          content: (
            <div className="w-56">
              <SessionSkeleton />
            </div>
          ),
        },
        {
          name: 'Many items (count=10)',
          content: (
            <div className="w-56">
              <SessionSkeleton count={10} />
            </div>
          ),
        },
      ]}
    />
  ),
}
