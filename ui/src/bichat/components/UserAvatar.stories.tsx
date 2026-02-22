import type { Meta, StoryObj } from '@storybook/react';

import { UserAvatar } from './UserAvatar';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof UserAvatar> = {
  title: 'BiChat/Components/UserAvatar',
  component: UserAvatar,
  parameters: { layout: 'centered' },
  argTypes: {
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof UserAvatar>

export const Playground: Story = {
  args: {
    firstName: 'Alice',
    lastName: 'Smith',
  },
};

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={3}
      scenarios={[
        {
          name: 'Small',
          content: (
            <div className="flex items-center gap-3">
              <UserAvatar firstName="Alice" lastName="Smith" size="sm" />
              <UserAvatar firstName="Bob" lastName="Jones" size="sm" />
              <UserAvatar firstName="Carol" lastName="White" size="sm" />
            </div>
          ),
        },
        {
          name: 'Medium (default)',
          content: (
            <div className="flex items-center gap-3">
              <UserAvatar firstName="David" lastName="Brown" size="md" />
              <UserAvatar firstName="Eve" lastName="Davis" size="md" />
              <UserAvatar firstName="Frank" lastName="Miller" size="md" />
            </div>
          ),
        },
        {
          name: 'Large',
          content: (
            <div className="flex items-center gap-3">
              <UserAvatar firstName="Grace" lastName="Wilson" size="lg" />
              <UserAvatar firstName="Hank" lastName="Moore" size="lg" />
              <UserAvatar firstName="Ivy" lastName="Taylor" size="lg" />
            </div>
          ),
        },
        {
          name: 'Custom Initials',
          content: (
            <div className="flex items-center gap-3">
              <UserAvatar firstName="Alice" lastName="Smith" initials="CEO" size="sm" />
              <UserAvatar firstName="Bob" lastName="Jones" initials="VP" size="md" />
              <UserAvatar firstName="Carol" lastName="White" initials="CTO" size="lg" />
            </div>
          ),
        },
        {
          name: 'Color Variations',
          description: 'Different name combos produce different deterministic colors',
          content: (
            <div className="flex items-center gap-2 flex-wrap">
              <UserAvatar firstName="Anna" lastName="Lee" />
              <UserAvatar firstName="Ben" lastName="Clark" />
              <UserAvatar firstName="Chloe" lastName="King" />
              <UserAvatar firstName="Dan" lastName="Young" />
              <UserAvatar firstName="Ella" lastName="Hall" />
              <UserAvatar firstName="Finn" lastName="Adams" />
              <UserAvatar firstName="Gina" lastName="Scott" />
              <UserAvatar firstName="Hugo" lastName="Baker" />
            </div>
          ),
        },
        {
          name: 'Edge Cases',
          description: 'Empty names, single name, whitespace',
          content: (
            <div className="flex items-center gap-3">
              <UserAvatar firstName="" lastName="" />
              <UserAvatar firstName="Z" lastName="" />
              <UserAvatar firstName="" lastName="Q" />
              <UserAvatar firstName="  " lastName="  " />
            </div>
          ),
        },
      ]}
    />
  ),
};
