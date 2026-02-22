import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { ScrollToBottomButton } from './ScrollToBottomButton';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof ScrollToBottomButton> = {
  title: 'BiChat/Components/ScrollToBottomButton',
  component: ScrollToBottomButton,
  parameters: { layout: 'centered' },
  argTypes: {
    show: { control: 'boolean' },
    disabled: { control: 'boolean' },
    unreadCount: { control: { type: 'number', min: 0, max: 200 } },
  },
  decorators: [
    (Story) => (
      <div className="relative h-32 w-64">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ScrollToBottomButton>

// ---------------------------------------------------------------------------
// 1. Playground — interactive with controls
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    show: true,
    disabled: false,
    unreadCount: 0,
    onClick: fn(),
  },
};

// ---------------------------------------------------------------------------
// 2. WithUnreadBadge — shows unread count badge
// ---------------------------------------------------------------------------

export const WithUnreadBadge: Story = {
  args: {
    show: true,
    unreadCount: 5,
    onClick: fn(),
  },
};

// ---------------------------------------------------------------------------
// 3. PillVariant — pill-style button with label
// ---------------------------------------------------------------------------

export const PillVariant: Story = {
  args: {
    show: true,
    label: 'New messages',
    onClick: fn(),
  },
};

// ---------------------------------------------------------------------------
// 4. Disabled — disabled state
// ---------------------------------------------------------------------------

export const Disabled: Story = {
  args: {
    show: true,
    disabled: true,
    onClick: fn(),
  },
};

// ---------------------------------------------------------------------------
// 5. Stress — ScenarioGrid covering variants
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
          name: 'Default',
          description: 'Basic scroll-to-bottom button',
          content: (
            <div className="relative h-32 w-64">
              <ScrollToBottomButton
                show
                onClick={fn()}
              />
            </div>
          ),
        },
        {
          name: 'With Badge',
          description: 'unreadCount=12',
          content: (
            <div className="relative h-32 w-64">
              <ScrollToBottomButton
                show
                unreadCount={12}
                onClick={fn()}
              />
            </div>
          ),
        },
        {
          name: 'Pill',
          description: 'label="New messages"',
          content: (
            <div className="relative h-32 w-64">
              <ScrollToBottomButton
                show
                label="New messages"
                onClick={fn()}
              />
            </div>
          ),
        },
        {
          name: 'Disabled',
          description: 'disabled=true',
          content: (
            <div className="relative h-32 w-64">
              <ScrollToBottomButton
                show
                disabled
                onClick={fn()}
              />
            </div>
          ),
        },
      ]}
    />
  ),
};
