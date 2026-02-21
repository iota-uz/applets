import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

import { SearchInput } from './SearchInput'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof SearchInput> = {
  title: 'BiChat/Components/SearchInput',
  component: SearchInput,
  parameters: { layout: 'centered' },
  argTypes: {
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SearchInput>

// ---------------------------------------------------------------------------
// 1. Playground — interactive with controls
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    value: '',
    placeholder: 'Search...',
    size: 'md',
    disabled: false,
    onChange: fn(),
    onSubmit: fn(),
    onEscape: fn(),
  },
}

// ---------------------------------------------------------------------------
// 2. WithValue — shows the clear button
// ---------------------------------------------------------------------------

export const WithValue: Story = {
  args: {
    value: 'revenue analysis',
    onChange: fn(),
    onSubmit: fn(),
  },
}

// ---------------------------------------------------------------------------
// 3. Disabled — disabled state with value
// ---------------------------------------------------------------------------

export const Disabled: Story = {
  args: {
    value: 'revenue analysis',
    disabled: true,
    onChange: fn(),
  },
}

// ---------------------------------------------------------------------------
// 4. Stress — ScenarioGrid covering edge cases
// ---------------------------------------------------------------------------

export const Stress: Story = {
  decorators: [
    (Story) => (
      <div className="w-[42rem]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Empty (sm)',
          description: 'size=sm, no value',
          content: (
            <div className="w-64">
              <SearchInput
                value=""
                onChange={fn()}
                size="sm"
                placeholder="Search..."
              />
            </div>
          ),
        },
        {
          name: 'Filled (md)',
          description: 'size=md, with value and clear button',
          content: (
            <div className="w-64">
              <SearchInput
                value="quarterly report data"
                onChange={fn()}
                size="md"
              />
            </div>
          ),
        },
        {
          name: 'Disabled (lg)',
          description: 'size=lg, disabled with value',
          content: (
            <div className="w-64">
              <SearchInput
                value="locked search"
                onChange={fn()}
                size="lg"
                disabled
              />
            </div>
          ),
        },
        {
          name: 'No Placeholder',
          description: 'Empty value, no placeholder prop',
          content: (
            <div className="w-64">
              <SearchInput
                value=""
                onChange={fn()}
                size="md"
              />
            </div>
          ),
        },
      ]}
    />
  ),
}
