import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

import { EditableText } from './EditableText'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof EditableText> = {
  title: 'BiChat/Components/EditableText',
  component: EditableText,
  parameters: { layout: 'centered' },
  argTypes: {
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md', 'lg'],
    },
    isLoading: { control: 'boolean' },
    placeholder: { control: 'text' },
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
type Story = StoryObj<typeof EditableText>

// ---------------------------------------------------------------------------
// 1. Playground — interactive with all controls
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    value: 'Revenue Analysis Q4',
    size: 'sm',
    isLoading: false,
    maxLength: 100,
    onSave: fn(),
  },
}

// ---------------------------------------------------------------------------
// 2. Loading — isLoading=true showing spinner
// ---------------------------------------------------------------------------

export const Loading: Story = {
  args: {
    value: 'Generating title...',
    isLoading: true,
    onSave: fn(),
  },
}

// ---------------------------------------------------------------------------
// 3. Empty — empty value with placeholder
// ---------------------------------------------------------------------------

export const Empty: Story = {
  args: {
    value: '',
    placeholder: 'Untitled',
    onSave: fn(),
  },
}

// ---------------------------------------------------------------------------
// 4. Stress — ScenarioGrid covering edge cases
// ---------------------------------------------------------------------------

const longText =
  'This is a very long editable title that exceeds typical length to test how the component handles truncation and overflow in a narrow container'

const stressOnSave = fn()
export const Stress: Story = {
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="w-[42rem] overflow-x-auto p-4">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Normal',
          description: 'Default value, double-click to edit',
          content: (
            <div className="w-64">
              <EditableText
                value="Revenue Analysis Q4"
                onSave={stressOnSave}
              />
            </div>
          ),
        },
        {
          name: 'Loading',
          description: 'isLoading=true with spinner',
          content: (
            <div className="w-64">
              <EditableText
                value="Generating title..."
                isLoading
                onSave={stressOnSave}
              />
            </div>
          ),
        },
        {
          name: 'Empty with Placeholder',
          description: 'value="" with placeholder text',
          content: (
            <div className="w-64">
              <EditableText
                value=""
                placeholder="Untitled"
                onSave={stressOnSave}
              />
            </div>
          ),
        },
        {
          name: 'Long Text (100+ chars)',
          description: 'Tests text overflow and truncation',
          content: (
            <div className="w-64">
              <EditableText
                value={longText}
                onSave={stressOnSave}
              />
            </div>
          ),
        },
      ]}
    />
  ),
}
