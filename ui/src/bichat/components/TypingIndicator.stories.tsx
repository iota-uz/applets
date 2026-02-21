import type { Meta, StoryObj } from '@storybook/react'

import { TypingIndicator } from './TypingIndicator'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof TypingIndicator> = {
  title: 'BiChat/Components/TypingIndicator',
  component: TypingIndicator,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof TypingIndicator>

export const Playground: Story = {}

export const CustomVerbs: Story = {
  args: {
    verbs: ['Analyzing', 'Computing', 'Generating', 'Synthesizing'],
  },
}

export const FastRotation: Story = {
  args: {
    rotationInterval: 1000,
  },
}

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      scenarios={[
        {
          name: 'Default',
          content: <TypingIndicator />,
        },
        {
          name: 'Custom Verbs',
          content: (
            <TypingIndicator
              verbs={['Analyzing', 'Computing', 'Generating', 'Synthesizing']}
            />
          ),
        },
        {
          name: 'Fast Rotation',
          content: <TypingIndicator rotationInterval={1000} />,
        },
      ]}
    />
  ),
}
