/**
 * AvatarStack Component
 * Displays overlapping user avatars with an overflow "+N" indicator.
 * Used in ChatHeader and SessionItem for group chat visualization.
 */

import { memo } from 'react';
import { UserAvatar } from './UserAvatar';

export interface AvatarStackProps {
  /** List of users to display */
  users: Array<{ firstName: string; lastName: string; initials?: string }>
  /** Maximum avatars to show before "+N" (default: 3) */
  max?: number
  /** Avatar size */
  size?: 'xs' | 'sm'
  /** Click handler — makes the stack interactive */
  onClick?: () => void
  /** Additional CSS classes */
  className?: string
}

const overlapClasses = {
  xs: '-ml-1.5',
  sm: '-ml-2',
} as const;

const badgeSizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
} as const;

function AvatarStackInner({
  users,
  max = 3,
  size = 'sm',
  onClick,
  className = '',
}: AvatarStackProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  const interactive = typeof onClick === 'function';
  const overlap = overlapClasses[size];
  const badgeSize = badgeSizeClasses[size];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (interactive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick!();
    }
  };

  return (
    <div
      className={`inline-flex items-center ${interactive ? 'cursor-pointer transition-opacity hover:opacity-80' : ''} ${className}`}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${users.length} members` : undefined}
    >
      {visible.map((user, i) => (
        <div
          key={`${user.firstName}-${user.lastName}-${i}`}
          className={`${i > 0 ? overlap : ''} ring-2 ring-white dark:ring-gray-900 rounded-full`}
          style={{ zIndex: visible.length - i }}
        >
          <UserAvatar
            firstName={user.firstName}
            lastName={user.lastName}
            initials={user.initials}
            size={size}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={`${overlap} ${badgeSize} rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium flex items-center justify-center flex-shrink-0 ring-2 ring-white dark:ring-gray-900`}
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

const AvatarStack = memo(AvatarStackInner);
AvatarStack.displayName = 'AvatarStack';

export { AvatarStack };
export default AvatarStack;
