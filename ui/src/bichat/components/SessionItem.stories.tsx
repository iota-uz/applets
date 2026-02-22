import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import SessionItem from './SessionItem';
import { makeSession } from '@sb-helpers/bichatFixtures';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof SessionItem> = {
  title: 'BiChat/Components/SessionItem',
  component: SessionItem,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    isActive: { control: 'boolean' },
    mode: {
      control: 'radio',
      options: ['active', 'archived'],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SessionItem>

// ---------------------------------------------------------------------------
// 1. Playground — interactive with all callbacks
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    session: makeSession({ title: 'Revenue analysis Q4' }),
    isActive: true,
    mode: 'active',
    onSelect: fn(),
    onArchive: fn(),
    onRestore: fn(),
    onPin: fn(),
    onRename: fn(),
    onRegenerateTitle: fn(),
    onDelete: fn(),
  },
};

// ---------------------------------------------------------------------------
// 2. ActiveHighlighted — shows the active highlight style
// ---------------------------------------------------------------------------

export const ActiveHighlighted: Story = {
  args: {
    session: makeSession({ title: 'Currently selected session' }),
    isActive: true,
    mode: 'active',
    onSelect: fn(),
    onArchive: fn(),
    onPin: fn(),
    onRename: fn(),
    onRegenerateTitle: fn(),
    onDelete: fn(),
  },
};

// ---------------------------------------------------------------------------
// 3. Pinned — pinned session showing pin icon
// ---------------------------------------------------------------------------

export const Pinned: Story = {
  args: {
    session: makeSession({ title: 'Pinned analysis', pinned: true }),
    isActive: false,
    mode: 'active',
    onSelect: fn(),
    onArchive: fn(),
    onPin: fn(),
    onRename: fn(),
    onRegenerateTitle: fn(),
    onDelete: fn(),
  },
};

// ---------------------------------------------------------------------------
// 4. Archived — archived mode with restore button
// ---------------------------------------------------------------------------

export const Archived: Story = {
  args: {
    session: makeSession({ title: 'Old quarterly report', status: 'archived' }),
    isActive: false,
    mode: 'archived',
    onSelect: fn(),
    onRestore: fn(),
    onRename: fn(),
    onDelete: fn(),
  },
};

// ---------------------------------------------------------------------------
// 5. TitleGenerating — empty/whitespace title shows generating state
// ---------------------------------------------------------------------------

export const TitleGenerating: Story = {
  args: {
    session: makeSession({ title: '' }),
    isActive: false,
    mode: 'active',
    onSelect: fn(),
    onArchive: fn(),
    onPin: fn(),
    onRename: fn(),
    onRegenerateTitle: fn(),
    onDelete: fn(),
  },
};

// ---------------------------------------------------------------------------
// 6. Stress — ScenarioGrid covering edge cases
// ---------------------------------------------------------------------------

const longTitle =
  'This is an extremely long session title that exceeds one hundred characters in order to verify how the component handles text overflow and truncation in a narrow sidebar layout';

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
          name: 'Active (highlighted)',
          description: 'isActive=true, default mode',
          content: (
            <div className="w-64">
              <SessionItem
                session={makeSession({ title: 'Active session' })}
                isActive={true}
                onSelect={fn()}
                onArchive={fn()}
                onPin={fn()}
                onRename={fn()}
                onRegenerateTitle={fn()}
                onDelete={fn()}
              />
            </div>
          ),
        },
        {
          name: 'Inactive',
          description: 'isActive=false, default mode',
          content: (
            <div className="w-64">
              <SessionItem
                session={makeSession({ title: 'Inactive session' })}
                isActive={false}
                onSelect={fn()}
                onArchive={fn()}
                onPin={fn()}
                onRename={fn()}
                onRegenerateTitle={fn()}
                onDelete={fn()}
              />
            </div>
          ),
        },
        {
          name: 'Pinned',
          description: 'pinned=true with unpin toggle',
          content: (
            <div className="w-64">
              <SessionItem
                session={makeSession({ title: 'Pinned session', pinned: true })}
                isActive={false}
                onSelect={fn()}
                onArchive={fn()}
                onPin={fn()}
                onRename={fn()}
                onRegenerateTitle={fn()}
                onDelete={fn()}
              />
            </div>
          ),
        },
        {
          name: 'Archived',
          description: 'mode=archived with restore action',
          content: (
            <div className="w-64">
              <SessionItem
                session={makeSession({ title: 'Archived session', status: 'archived' })}
                isActive={false}
                mode="archived"
                onSelect={fn()}
                onRestore={fn()}
                onRename={fn()}
                onDelete={fn()}
              />
            </div>
          ),
        },
        {
          name: 'Long Title (100+ chars)',
          description: 'Tests text overflow handling',
          content: (
            <div className="w-64">
              <SessionItem
                session={makeSession({ title: longTitle })}
                isActive={false}
                onSelect={fn()}
                onArchive={fn()}
                onPin={fn()}
                onRename={fn()}
                onRegenerateTitle={fn()}
                onDelete={fn()}
              />
            </div>
          ),
        },
        {
          name: 'Title Generating',
          description: 'Empty title shows generating state',
          content: (
            <div className="w-64">
              <SessionItem
                session={makeSession({ title: '' })}
                isActive={false}
                onSelect={fn()}
                onArchive={fn()}
                onPin={fn()}
                onRename={fn()}
                onRegenerateTitle={fn()}
                onDelete={fn()}
              />
            </div>
          ),
        },
      ]}
    />
  ),
};
