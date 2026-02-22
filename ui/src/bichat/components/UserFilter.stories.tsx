import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { UserFilter } from './UserFilter';
import { makeSessionUser } from '@sb-helpers/bichatFixtures';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof UserFilter> = {
  title: 'BiChat/Components/UserFilter',
  component: UserFilter,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof UserFilter>

const fewUsers = [
  makeSessionUser({ id: 'u-1', firstName: 'Alice', lastName: 'Smith', initials: 'AS' }),
  makeSessionUser({ id: 'u-2', firstName: 'Bob', lastName: 'Johnson', initials: 'BJ' }),
  makeSessionUser({ id: 'u-3', firstName: 'Carol', lastName: 'Williams', initials: 'CW' }),
];

const manyUsers = [
  ...fewUsers,
  makeSessionUser({ id: 'u-4', firstName: 'David', lastName: 'Brown', initials: 'DB' }),
  makeSessionUser({ id: 'u-5', firstName: 'Eve', lastName: 'Martinez', initials: 'EM' }),
  makeSessionUser({ id: 'u-6', firstName: 'Frank', lastName: 'Garcia', initials: 'FG' }),
  makeSessionUser({ id: 'u-7', firstName: 'Grace', lastName: 'Lee', initials: 'GL' }),
  makeSessionUser({ id: 'u-8', firstName: 'Henry', lastName: 'Wilson', initials: 'HW' }),
  makeSessionUser({ id: 'u-9', firstName: 'Ivy', lastName: 'Anderson', initials: 'IA' }),
  makeSessionUser({ id: 'u-10', firstName: 'Jack', lastName: 'Thomas', initials: 'JT' }),
];

export const Playground: Story = {
  args: {
    users: fewUsers,
    selectedUser: null,
    onUserChange: fn(),
  },
};

export const WithSelectedUser: Story = {
  args: {
    users: fewUsers,
    selectedUser: fewUsers[1],
    onUserChange: fn(),
  },
};

export const Loading: Story = {
  args: {
    users: [],
    selectedUser: null,
    onUserChange: fn(),
    loading: true,
  },
};

export const Stress: Story = {
  render: () => {
    const noop = fn();
    return (
      <ScenarioGrid
        columns={2}
        scenarios={[
          {
            name: 'No selection (placeholder)',
            content: <UserFilter users={fewUsers} selectedUser={null} onUserChange={noop} />,
          },
          {
            name: 'User selected (shows avatar + clear btn)',
            content: <UserFilter users={fewUsers} selectedUser={fewUsers[0]} onUserChange={noop} />,
          },
          {
            name: 'Loading state (disabled)',
            content: <UserFilter users={[]} selectedUser={null} onUserChange={noop} loading />,
          },
          {
            name: 'No users available',
            content: <UserFilter users={[]} selectedUser={null} onUserChange={noop} />,
          },
          {
            name: 'Many users (10 — dropdown scrolls)',
            content: <UserFilter users={manyUsers} selectedUser={null} onUserChange={noop} />,
          },
          (() => {
            const longUser = makeSessionUser({
              id: 'u-long',
              firstName: 'Alexandria',
              lastName: 'Bartholomew-Richardson III',
              initials: 'AB',
            });
            return {
              name: 'Long user name (truncation)',
              content: (
                <UserFilter
                  users={[longUser]}
                  selectedUser={longUser}
                  onUserChange={noop}
                />
              ),
            };
          })(),
        ]}
      />
    );
  },
};
