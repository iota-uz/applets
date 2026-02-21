import type { Meta, StoryObj } from '@storybook/react'

import { LoadingSpinner } from './LoadingSpinner'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof LoadingSpinner> = {
  title: 'BiChat/Components/LoadingSpinner',
  component: LoadingSpinner,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: { type: 'radio' },
      options: ['spinner', 'dots', 'pulse'],
    },
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof LoadingSpinner>

export const Playground: Story = {
  args: {
    variant: 'spinner',
  },
}

export const WithMessage: Story = {
  args: {
    variant: 'spinner',
    message: 'Loading data...',
  },
}

export const Stress: Story = {
  render: () => {
    const variants = ['spinner', 'dots', 'pulse'] as const
    const sizes = ['sm', 'md', 'lg'] as const

    return (
      <ScenarioGrid
        columns={3}
        scenarios={variants.flatMap((variant) =>
          sizes.map((size) => ({
            name: `${variant} / ${size}`,
            content: (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner variant={variant} size={size} />
              </div>
            ),
          }))
        )}
      />
    )
  },
}
