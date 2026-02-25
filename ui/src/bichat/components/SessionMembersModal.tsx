/**
 * SessionMembersModal
 * Polished sharing dialog for managing session members.
 * Uses InlineDialog, UserAvatars, custom search dropdown, and segmented role controls.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  InlineDialog, InlineDialogBackdrop, InlineDialogPanel, InlineDialogTitle,
} from './InlineDialog';
import { UserPlus, Trash, Crown, UsersThree, MagnifyingGlass, X } from '@phosphor-icons/react';
import type { ChatDataSource, SessionMember, SessionUser } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { UserAvatar } from './UserAvatar';
import { ConfirmModal } from './ConfirmModal';

export interface SessionMembersModalProps {
  isOpen: boolean
  sessionId?: string
  dataSource: ChatDataSource
  onClose: () => void
}

// ---------------------------------------------------------------------------
// RoleSegmentedControl
// ---------------------------------------------------------------------------

const ROLES: readonly ['editor', 'viewer'] = ['editor', 'viewer'];

function RoleSegmentedControl({
  value,
  onChange,
  disabled,
  size = 'md',
  t,
}: {
  value: 'editor' | 'viewer'
  onChange: (role: 'editor' | 'viewer') => void
  disabled?: boolean
  size?: 'sm' | 'md'
  t: (key: string) => string
}) {
  const btnBase = size === 'sm'
    ? 'px-2 py-0.5 text-[11px]'
    : 'px-3 py-1 text-xs';
  const currentIndex = ROLES.indexOf(value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) {return;}
    let nextIndex: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = currentIndex <= 0 ? ROLES.length - 1 : currentIndex - 1;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = currentIndex >= ROLES.length - 1 ? 0 : currentIndex + 1;
    }
    if (nextIndex !== null) {
      const nextRole = ROLES[nextIndex];
      onChange(nextRole);
      const target = e.currentTarget.querySelector(`[data-role="${nextRole}"]`) as HTMLButtonElement | null;
      target?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('BiChat.Share.RoleLabel')}
      className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800/50"
      onKeyDown={handleKeyDown}
    >
      {ROLES.map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={value === role}
          tabIndex={value === role ? 0 : -1}
          data-role={role}
          disabled={disabled}
          onClick={() => onChange(role)}
          className={`${btnBase} cursor-pointer rounded-md font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${
            value === role
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          {role === 'editor' ? t('BiChat.Share.RoleEditor') : t('BiChat.Share.RoleViewer')}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MemberSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" aria-hidden="true">
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-2.5 w-16 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
      <div className="h-6 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionMembersModal
// ---------------------------------------------------------------------------

export function SessionMembersModal({ isOpen, sessionId, dataSource, onClose }: SessionMembersModalProps) {
  const headingId = useId();
  const { t } = useTranslation();
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [selectedUser, setSelectedUser] = useState<SessionUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer'>('editor');
  const [query, setQuery] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<SessionMember | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownHighlightIndex, setDropdownHighlightIndex] = useState(0);
  const dropdownOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const canManageMembers = Boolean(
    dataSource.listUsers
    && dataSource.listSessionMembers
    && dataSource.addSessionMember
    && dataSource.updateSessionMemberRole
    && dataSource.removeSessionMember
  );

  const refresh = useCallback(async () => {
    if (!sessionId || !canManageMembers) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [usersData, membersData] = await Promise.all([
        dataSource.listUsers!(),
        dataSource.listSessionMembers!(sessionId),
      ]);
      setUsers(usersData);
      setMembers(membersData);
    } catch {
      setError(t('BiChat.Share.LoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [canManageMembers, dataSource, sessionId, t]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void refresh();
  }, [isOpen, refresh]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedUser(null);
      setSelectedRole('editor');
      setError(null);
      setConfirmRemove(null);
      setStatusMessage(null);
      setDropdownOpen(false);
      setDropdownHighlightIndex(0);
    }
  }, [isOpen]);

  const memberIDs = useMemo(() => new Set(members.map((m) => m.user.id)), [members]);
  const availableUsers = useMemo(
    () => users.filter((user) => !memberIDs.has(user.id)),
    [users, memberIDs],
  );

  const filteredUsers = useMemo(() => {
    if (!query.trim()) {
      return availableUsers;
    }
    const q = query.toLowerCase();
    return availableUsers.filter(
      (u) =>
        u.firstName.toLowerCase().includes(q)
        || u.lastName.toLowerCase().includes(q)
        || `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)
    );
  }, [availableUsers, query]);

  // Reset dropdown highlight when filtered list changes
  useEffect(() => {
    setDropdownHighlightIndex((i) =>
      Math.min(Math.max(0, i), Math.max(0, filteredUsers.length - 1))
    );
  }, [filteredUsers.length]);

  useEffect(() => () => clearTimeout(statusTimerRef.current), []);

  const flashStatus = (msg: string) => {
    clearTimeout(statusTimerRef.current);
    setStatusMessage(msg);
    statusTimerRef.current = setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleAdd = async () => {
    if (!sessionId || !selectedUser || !dataSource.addSessionMember) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await dataSource.addSessionMember(sessionId, selectedUser.id, selectedRole);
      setSelectedUser(null);
      setQuery('');
      flashStatus(t('BiChat.Share.MemberAdded'));
      await refresh();
    } catch {
      setError(t('BiChat.Share.AddFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: 'editor' | 'viewer') => {
    if (!sessionId || !dataSource.updateSessionMemberRole) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await dataSource.updateSessionMemberRole(sessionId, userId, role);
      await refresh();
    } catch {
      setError(t('BiChat.Share.UpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!sessionId || !dataSource.removeSessionMember) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await dataSource.removeSessionMember(sessionId, userId);
      flashStatus(t('BiChat.Share.MemberRemoved'));
      await refresh();
    } catch {
      setError(t('BiChat.Share.RemoveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <InlineDialog open={isOpen} onClose={onClose} className="relative z-40">
        <InlineDialogBackdrop className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-200" />

        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <InlineDialogPanel
            aria-labelledby={headingId}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/30 max-w-md w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200/60 dark:border-primary-800/40">
                  <UsersThree size={18} weight="duotone" className="text-primary-600 dark:text-primary-400" />
                </div>
                <InlineDialogTitle id={headingId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {t('BiChat.Share.Title')}
                </InlineDialogTitle>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                aria-label={t('BiChat.Common.Close')}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 pb-5 space-y-4">
              {!canManageMembers && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
                  {t('BiChat.Share.Unsupported')}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </div>
              )}

              {/* Status announcements for screen readers */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {statusMessage}
              </div>

              {/* Members list */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('BiChat.Share.Members')}{!loading && members.length > 0 ? ` (${members.length})` : ''}
                </h3>

                <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-1">
                  {loading ? (
                    <>
                      <MemberSkeleton />
                      <MemberSkeleton />
                      <MemberSkeleton />
                    </>
                  ) : members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                      <UsersThree size={32} weight="thin" className="mb-2" />
                      <p className="text-sm">{t('BiChat.Share.Empty')}</p>
                    </div>
                  ) : (
                    members.map((member) => (
                      <div
                        key={member.user.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
                      >
                        <UserAvatar
                          firstName={member.user.firstName}
                          lastName={member.user.lastName}
                          initials={member.user.initials}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {member.user.firstName} {member.user.lastName}
                          </div>
                        </div>

                        {member.role === 'owner' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            <Crown size={12} weight="duotone" />
                            {t('BiChat.Share.RoleOwner')}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <RoleSegmentedControl
                              value={member.role === 'viewer' ? 'viewer' : 'editor'}
                              onChange={(role) => handleUpdateRole(member.user.id, role)}
                              disabled={saving}
                              size="sm"
                              t={t}
                            />
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setConfirmRemove(member)}
                              className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                              aria-label={`${t('BiChat.Share.Remove')} ${member.user.firstName} ${member.user.lastName}`}
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add member */}
              {canManageMembers && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('BiChat.Share.AddMember')}
                  </h3>

                  {/* User search + dropdown */}
                  <div className="relative">
                    <div className="relative">
                      <MagnifyingGlass
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                      />
                      <input
                        type="text"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:border-primary-400 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        placeholder={t('BiChat.Share.SearchUsers')}
                        value={selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : query}
                        onFocus={() => { setDropdownOpen(true); setDropdownHighlightIndex(0); if (selectedUser) { setSelectedUser(null); setQuery(''); } }}
                        onBlur={() => setDropdownOpen(false)}
                        onChange={(e) => { setQuery(e.target.value); setSelectedUser(null); setDropdownOpen(true); setDropdownHighlightIndex(0); }}
                        onKeyDown={(e) => {
                          if (!dropdownOpen || filteredUsers.length === 0) {
                            if (e.key === 'Escape') { setDropdownOpen(false); }
                            return;
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setDropdownOpen(false);
                            setDropdownHighlightIndex(0);
                            return;
                          }
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            const next = (dropdownHighlightIndex + 1) % filteredUsers.length;
                            setDropdownHighlightIndex(next);
                            setTimeout(() => dropdownOptionRefs.current[next]?.focus(), 0);
                            return;
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const next = dropdownHighlightIndex <= 0 ? filteredUsers.length - 1 : dropdownHighlightIndex - 1;
                            setDropdownHighlightIndex(next);
                            setTimeout(() => dropdownOptionRefs.current[next]?.focus(), 0);
                            return;
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const user = filteredUsers[dropdownHighlightIndex];
                            if (user) {
                              setSelectedUser(user);
                              setQuery('');
                              setDropdownOpen(false);
                            }
                          }
                        }}
                      />
                    </div>

                    {dropdownOpen && !selectedUser && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                        {filteredUsers.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {availableUsers.length === 0
                              ? t('BiChat.Share.NoUsersAvailable')
                              : t('BiChat.Share.NoSearchResults')}
                          </div>
                        ) : (
                          filteredUsers.map((user, index) => (
                            <button
                              key={user.id}
                              type="button"
                              ref={(el) => { dropdownOptionRefs.current[index] = el; }}
                              className={`flex w-full items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20 ${index === dropdownHighlightIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setSelectedUser(user); setQuery(''); setDropdownOpen(false); }}
                            >
                              <UserAvatar
                                firstName={user.firstName}
                                lastName={user.lastName}
                                initials={user.initials}
                                size="xs"
                              />
                              <span className="text-sm text-gray-900 dark:text-gray-100">
                                {user.firstName} {user.lastName}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Role selector + Add button */}
                  <div className="flex items-center justify-between">
                    <RoleSegmentedControl
                      value={selectedRole}
                      onChange={setSelectedRole}
                      disabled={saving}
                      t={t}
                    />
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={saving || !selectedUser}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-primary-700 hover:shadow active:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                    >
                      <UserPlus size={14} />
                      {t('BiChat.Share.Add')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </InlineDialogPanel>
        </div>
      </InlineDialog>

      {/* Remove confirmation */}
      <ConfirmModal
        isOpen={!!confirmRemove}
        isDanger
        title={t('BiChat.Share.RemoveConfirmTitle')}
        message={
          confirmRemove
            ? t('BiChat.Share.RemoveConfirmMessage').replace(
                '{{name}}',
                `${confirmRemove.user.firstName} ${confirmRemove.user.lastName}`
              )
            : ''
        }
        confirmText={t('BiChat.Share.Remove')}
        onConfirm={() => {
          if (confirmRemove) {
            void handleRemove(confirmRemove.user.id);
          }
          setConfirmRemove(null);
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </>
  );
}

export default SessionMembersModal;
