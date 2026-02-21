import type { Meta, StoryObj } from '@storybook/react'

import { PermissionGuard } from './PermissionGuard'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof PermissionGuard> = {
  title: 'BiChat/Components/PermissionGuard',
  component: PermissionGuard,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof PermissionGuard>

const ProtectedContent = ({ label = 'Protected content is visible.' }: { label?: string }) => (
  <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded border border-green-200 dark:border-green-800 text-sm">
    {label}
  </div>
)

const DeniedFallback = ({ label = 'You do not have permission.' }: { label?: string }) => (
  <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800 text-sm">
    {label}
  </div>
)

/** Simulates a user with specific permissions */
const makeChecker = (granted: string[]) => (p: string) => granted.includes(p)

export const AllGranted: Story = {
  args: {
    permissions: ['chat.read', 'chat.write'],
    mode: 'all',
    hasPermission: makeChecker(['chat.read', 'chat.write']),
    fallback: <DeniedFallback />,
    children: <ProtectedContent />,
  },
}

export const AllDenied: Story = {
  args: {
    permissions: ['chat.admin'],
    mode: 'all',
    hasPermission: makeChecker([]),
    fallback: <DeniedFallback />,
    children: <ProtectedContent />,
  },
}

export const AnyModePartialMatch: Story = {
  args: {
    permissions: ['chat.admin', 'chat.read'],
    mode: 'any',
    hasPermission: makeChecker(['chat.read']),
    fallback: <DeniedFallback label="None of the required permissions granted." />,
    children: <ProtectedContent label="Visible because at least one permission matched (mode=any)." />,
  },
}

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'mode=all — all permissions granted',
          content: (
            <PermissionGuard
              permissions={['chat.read', 'chat.write']}
              mode="all"
              hasPermission={makeChecker(['chat.read', 'chat.write', 'chat.admin'])}
              fallback={<DeniedFallback />}
            >
              <ProtectedContent label="All required permissions met." />
            </PermissionGuard>
          ),
        },
        {
          name: 'mode=all — partial permissions (denied)',
          content: (
            <PermissionGuard
              permissions={['chat.read', 'chat.admin']}
              mode="all"
              hasPermission={makeChecker(['chat.read'])}
              fallback={<DeniedFallback label="Missing chat.admin permission." />}
            >
              <ProtectedContent />
            </PermissionGuard>
          ),
        },
        {
          name: 'mode=any — one of two granted',
          content: (
            <PermissionGuard
              permissions={['chat.admin', 'chat.readOwn']}
              mode="any"
              hasPermission={makeChecker(['chat.readOwn'])}
              fallback={<DeniedFallback />}
            >
              <ProtectedContent label="chat.readOwn matched (mode=any)." />
            </PermissionGuard>
          ),
        },
        {
          name: 'mode=any — none granted (denied)',
          content: (
            <PermissionGuard
              permissions={['chat.admin', 'chat.superuser']}
              mode="any"
              hasPermission={makeChecker([])}
              fallback={<DeniedFallback label="No matching permissions." />}
            >
              <ProtectedContent />
            </PermissionGuard>
          ),
        },
        {
          name: 'Empty permissions array (always allowed)',
          content: (
            <PermissionGuard
              permissions={[]}
              hasPermission={makeChecker([])}
              fallback={<DeniedFallback />}
            >
              <ProtectedContent label="No permissions required — always shown." />
            </PermissionGuard>
          ),
        },
        {
          name: 'No fallback provided (renders nothing)',
          content: (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-400 text-center min-h-[60px] flex items-center justify-center">
              <PermissionGuard
                permissions={['chat.admin']}
                hasPermission={makeChecker([])}
              >
                <ProtectedContent />
              </PermissionGuard>
              <span>Nothing renders here (no fallback).</span>
            </div>
          ),
        },
      ]}
    />
  ),
}
