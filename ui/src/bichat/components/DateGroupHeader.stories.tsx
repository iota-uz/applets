import type { Meta, StoryObj } from '@storybook/react';

import DateGroupHeader from './DateGroupHeader';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof DateGroupHeader> = {
  title: 'BiChat/Components/DateGroupHeader',
  component: DateGroupHeader,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof DateGroupHeader>

export const Playground: Story = {
  args: {
    groupName: 'Today',
    count: 5,
  },
};

export const WithCount: Story = {
  args: {
    groupName: 'Last 7 days',
    count: 23,
  },
};

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      scenarios={[
        {
          name: 'Today',
          content: (
            <div className="w-64">
              <DateGroupHeader groupName="Today" count={3} />
            </div>
          ),
        },
        {
          name: 'Yesterday',
          content: (
            <div className="w-64">
              <DateGroupHeader groupName="Yesterday" count={7} />
            </div>
          ),
        },
        {
          name: 'Last Week',
          content: (
            <div className="w-64">
              <DateGroupHeader groupName="Last Week" count={14} />
            </div>
          ),
        },
        {
          name: 'Last 30 days',
          content: (
            <div className="w-64">
              <DateGroupHeader groupName="Last 30 days" count={42} />
            </div>
          ),
        },
        {
          name: 'Zero count',
          content: (
            <div className="w-64">
              <DateGroupHeader groupName="Older" count={0} />
            </div>
          ),
        },
        {
          name: 'Long label',
          content: (
            <div className="w-64">
              <DateGroupHeader groupName="February 2026" count={128} />
            </div>
          ),
        },
      ]}
    />
  ),
};
