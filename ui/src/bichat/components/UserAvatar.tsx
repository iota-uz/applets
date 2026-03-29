/**
 * UserAvatar Component
 * Displays user initials with deterministic color from a color palette
 */

import { memo } from 'react';

export interface UserAvatarProps {
  /** User's first name */
  firstName: string
  /** User's last name */
  lastName: string
  /** Override initials (defaults to first letters of first and last name) */
  initials?: string
  /** Avatar size */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
}

/**
 * Generate a consistent color index from a string
 * Uses simple hash function for deterministic color selection
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Color palette using hex values for inline styles.
 * Inline styles ensure colors render correctly in portaled content
 * (e.g. Headless UI dropdowns) outside the shadow DOM.
 */
const colorPalette = [
  { bg: '#3b82f6', text: '#ffffff' }, // blue-500
  { bg: '#22c55e', text: '#111827' }, // green-500 (light bg)
  { bg: '#a855f7', text: '#ffffff' }, // purple-500
  { bg: '#ec4899', text: '#ffffff' }, // pink-500
  { bg: '#6366f1', text: '#ffffff' }, // indigo-500
  { bg: '#14b8a6', text: '#111827' }, // teal-500 (light bg)
  { bg: '#f97316', text: '#ffffff' }, // orange-500
  { bg: '#06b6d4', text: '#111827' }, // cyan-500 (light bg)
  { bg: '#f59e0b', text: '#111827' }, // amber-500 (light bg)
  { bg: '#84cc16', text: '#111827' }, // lime-500 (light bg)
];

/**
 * Size configurations
 */
const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

function UserAvatar({
  firstName,
  lastName,
  initials: providedInitials,
  size = 'md',
  className = '',
}: UserAvatarProps) {
  // Generate initials if not provided
  const derivedInitials = (() => {
    const firstChar = firstName?.trim()?.charAt(0) || '';
    const lastChar = lastName?.trim()?.charAt(0) || '';
    const combined = `${firstChar}${lastChar}`.trim();
    return combined || 'U';
  })();

  const initials = (providedInitials?.trim() || derivedInitials).toUpperCase();

  // Select color based on full name hash (deterministic)
  const fullName = `${firstName}${lastName}`;
  const colorIndex = hashString(fullName) % colorPalette.length;
  const colors = colorPalette[colorIndex];

  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${className}
        rounded-full
        flex
        items-center
        justify-center
        font-semibold
        flex-shrink-0
        select-none
      `}
      style={{ backgroundColor: colors.bg, color: colors.text }}
      aria-label={`${firstName} ${lastName}`}
      title={`${firstName} ${lastName}`}
    >
      {initials}
    </div>
  );
}

const MemoizedUserAvatar = memo(UserAvatar);
MemoizedUserAvatar.displayName = 'UserAvatar';

export { MemoizedUserAvatar as UserAvatar };
export default MemoizedUserAvatar;
