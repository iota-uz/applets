import type { Meta, StoryObj } from '@storybook/react'

import SkipLink from './SkipLink'

const meta: Meta<typeof SkipLink> = {
  title: 'BiChat/Components/SkipLink',
  component: SkipLink,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof SkipLink>

export const Default: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <SkipLink />
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800 text-sm">
        <p className="font-medium mb-1">SkipLink is rendered above</p>
        <p>
          The link is visually hidden by default (<code>sr-only</code>).
          It becomes visible when focused via keyboard navigation.
        </p>
      </div>
      <div id="main-content" className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 text-sm">
        Target: <code>#main-content</code>
      </div>
    </div>
  ),
}

export const Focused: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <SkipLink />
      <div className="p-4 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-lg border border-violet-200 dark:border-violet-800 text-sm">
        <p className="font-medium mb-1">Press Tab to reveal the SkipLink</p>
        <p>
          Click somewhere in this story panel first, then press <kbd className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-800 rounded text-xs font-mono">Tab</kbd> to
          move keyboard focus to the skip link. It will appear in the top-left corner
          of the story viewport.
        </p>
      </div>
      <div id="main-content" className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 text-sm">
        Target: <code>#main-content</code>
      </div>
    </div>
  ),
}
