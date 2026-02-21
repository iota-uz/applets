import type { Meta, StoryObj } from '@storybook/react'

import Skeleton, {
  SkeletonGroup,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  ListItemSkeleton,
} from './Skeleton'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta = {
  title: 'BiChat/Components/Skeleton',
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj

export const Variants: Story = {
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Text',
          content: <Skeleton variant="text" width={200} height={16} />,
        },
        {
          name: 'Circular',
          content: <Skeleton variant="circular" width={48} height={48} />,
        },
        {
          name: 'Rectangular',
          content: <Skeleton variant="rectangular" width={200} height={60} />,
        },
        {
          name: 'Rounded',
          content: <Skeleton variant="rounded" width={200} height={60} />,
        },
      ]}
    />
  ),
}

export const TextLines: Story = {
  render: () => (
    <ScenarioGrid
      columns={3}
      scenarios={[
        {
          name: '1 line',
          content: (
            <div className="w-64">
              <SkeletonText lines={1} />
            </div>
          ),
        },
        {
          name: '3 lines',
          content: (
            <div className="w-64">
              <SkeletonText lines={3} />
            </div>
          ),
        },
        {
          name: '5 lines',
          content: (
            <div className="w-64">
              <SkeletonText lines={5} />
            </div>
          ),
        },
      ]}
    />
  ),
}

export const Group: Story = {
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Default (count=4)',
          content: (
            <div className="w-64">
              <SkeletonGroup count={4} />
            </div>
          ),
        },
        {
          name: 'Custom children',
          content: (
            <div className="w-64">
              <SkeletonGroup count={4} gap="lg">
                {(index) => (
                  <div className="flex items-center gap-3">
                    <SkeletonAvatar size={32} />
                    <Skeleton variant="text" height={14} width={`${80 - index * 10}%`} />
                  </div>
                )}
              </SkeletonGroup>
            </div>
          ),
        },
      ]}
    />
  ),
}

export const Cards: Story = {
  render: () => (
    <ScenarioGrid
      columns={3}
      scenarios={[
        {
          name: 'Small',
          content: <SkeletonCard width={180} height={80} />,
        },
        {
          name: 'Medium',
          content: <SkeletonCard width={240} height={120} />,
        },
        {
          name: 'Large',
          content: <SkeletonCard width={320} height={180} />,
        },
      ]}
    />
  ),
}

export const ListItems: Story = {
  render: () => (
    <div className="w-72 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
      <ListItemSkeleton />
      <ListItemSkeleton />
      <ListItemSkeleton />
    </div>
  ),
}

export const FullPage: Story = {
  name: 'Full Page (realistic)',
  render: () => (
    <div className="w-80 space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
      {/* Header: avatar + name + subtitle */}
      <div className="flex items-center gap-3">
        <SkeletonAvatar size={44} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={14} />
          <Skeleton variant="text" width="40%" height={12} />
        </div>
      </div>

      {/* Body text */}
      <SkeletonText lines={4} />

      {/* Card */}
      <SkeletonCard width="100%" height={100} />

      {/* List items */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    </div>
  ),
}
