import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, UserPlus, Trash } from '@phosphor-icons/react';
import type { ChatDataSource, SessionMember, SessionUser } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface SessionMembersModalProps {
  isOpen: boolean
  sessionId?: string
  dataSource: ChatDataSource
  onClose: () => void
}

export function SessionMembersModal({ isOpen, sessionId, dataSource, onClose }: SessionMembersModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer'>('editor');

  const canManageMembers = Boolean(
    dataSource.listUsers
    && dataSource.listSessionMembers
    && dataSource.addSessionMember
    && dataSource.updateSessionMemberRole
    && dataSource.removeSessionMember
  );

  const refresh = useCallback(async () => {
    if (!sessionId || !canManageMembers) {return;}
    setLoading(true);
    setError(null);
    try {
      const [usersData, membersData] = await Promise.all([
        dataSource.listUsers!(),
        dataSource.listSessionMembers!(sessionId),
      ]);
      setUsers(usersData);
      setMembers(membersData);
    } catch (err) {
      console.error('Failed to load session members:', err);
      setError(t('BiChat.Share.LoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [canManageMembers, dataSource, sessionId, t]);

  useEffect(() => {
    if (!isOpen) {return;}
    void refresh();
  }, [isOpen, refresh]);

  const memberIDs = useMemo(() => new Set(members.map((member) => member.user.id)), [members]);
  const availableUsers = useMemo(
    () => users.filter((user) => !memberIDs.has(user.id)),
    [users, memberIDs],
  );

  const onAdd = async () => {
    if (!sessionId || !selectedUserId || !dataSource.addSessionMember) {return;}
    setSaving(true);
    setError(null);
    try {
      await dataSource.addSessionMember(sessionId, selectedUserId, selectedRole);
      setSelectedUserId('');
      await refresh();
    } catch (err) {
      console.error('Failed to add session member:', err);
      setError(t('BiChat.Share.AddFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onUpdateRole = async (userId: string, role: 'editor' | 'viewer') => {
    if (!sessionId || !dataSource.updateSessionMemberRole) {return;}
    setSaving(true);
    setError(null);
    try {
      await dataSource.updateSessionMemberRole(sessionId, userId, role);
      await refresh();
    } catch (err) {
      console.error('Failed to update member role:', err);
      setError(t('BiChat.Share.UpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (userId: string) => {
    if (!sessionId || !dataSource.removeSessionMember) {return;}
    setSaving(true);
    setError(null);
    try {
      await dataSource.removeSessionMember(sessionId, userId);
      await refresh();
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError(t('BiChat.Share.RemoveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {return null;}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('BiChat.Share.Title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label={t('BiChat.Common.Close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {!canManageMembers && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {t('BiChat.Share.Unsupported')}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('BiChat.Share.Members')}
            </h3>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('BiChat.Common.Loading')}</div>
              ) : members.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('BiChat.Share.Empty')}</div>
              ) : (
                members.map((member) => (
                  <div
                    key={`${member.user.id}-${member.role}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-gray-900 dark:text-gray-100">
                        {member.user.firstName} {member.user.lastName}
                      </div>
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {member.user.id}
                      </div>
                    </div>
                    {member.role === 'owner' ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {t('BiChat.Share.RoleOwner')}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={member.role}
                          disabled={saving}
                          onChange={(e) => onUpdateRole(member.user.id, e.target.value === 'viewer' ? 'viewer' : 'editor')}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                        >
                          <option value="editor">{t('BiChat.Share.RoleEditor')}</option>
                          <option value="viewer">{t('BiChat.Share.RoleViewer')}</option>
                        </select>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onRemove(member.user.id)}
                          className="cursor-pointer rounded-md p-1 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          aria-label={t('BiChat.Share.Remove')}
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

          {canManageMembers && (
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('BiChat.Share.AddMember')}
              </h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,120px,auto]">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={saving || availableUsers.length === 0}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="">{t('BiChat.Share.SelectUser')}</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value === 'viewer' ? 'viewer' : 'editor')}
                  disabled={saving}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="editor">{t('BiChat.Share.RoleEditor')}</option>
                  <option value="viewer">{t('BiChat.Share.RoleViewer')}</option>
                </select>
                <button
                  type="button"
                  onClick={onAdd}
                  disabled={saving || !selectedUserId}
                  className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md bg-primary-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus size={14} />
                  {t('BiChat.Share.Add')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SessionMembersModal;
