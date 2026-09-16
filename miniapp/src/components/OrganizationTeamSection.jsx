import React, { useEffect, useMemo, useState } from 'react';
import { MailPlus, RefreshCw, ShieldAlert, UserMinus, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import {
  createMyOrganizationInvitation,
  listMyOrganizationInvitations,
  listMyOrganizationMembers,
  removeMyOrganizationMember,
  revokeMyOrganizationInvitation,
  updateMyOrganizationMemberRole
} from '../lib/api';
import { PremiumInput, SurfaceCard } from './ui';

function TeamButton({ icon: Icon, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--miniapp-border-color)] bg-[var(--tg-secondary-bg-color)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)] transition hover:border-[var(--tg-button-color)]"
    >
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

const ROLES = ['ADMINISTRATOR', 'FINANCE_MANAGER', 'OPERATIONS', 'ACCOUNTANT', 'VIEWER'];

export default function OrganizationTeamSection() {
  const { organizations, organizationContext } = useAppContext();
  const organization = organizationContext?.organization;
  const canManage = ['OWNER', 'ADMINISTRATOR'].includes(organization?.role);
  const organizationId = organization?.id;
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  const activeOrganization = useMemo(
    () => organizations.find((entry) => entry.id === organizationId) || organization,
    [organization, organizationId, organizations]
  );

  const loadTeam = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError('');
    try {
      const [memberResult, invitationResult] = await Promise.all([
        listMyOrganizationMembers(organizationId),
        canManage ? listMyOrganizationInvitations(organizationId) : Promise.resolve({ data: [] })
      ]);
      setMembers(memberResult?.data || []);
      setInvitations(invitationResult?.data || []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load organization team.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, [organizationId, canManage]);

  if (!organizationId || !activeOrganization || !canManage) {
    return null;
  }

  const inviteMember = async () => {
    if (!email.trim()) {
      toast.error('Enter a member email.');
      return;
    }
    try {
      const result = await createMyOrganizationInvitation(organizationId, { email: email.trim(), role });
      setInviteToken(result?.token || '');
      setEmail('');
      toast.success('Invitation created. Share the one-time token securely.');
      await loadTeam();
    } catch (inviteError) {
      toast.error(inviteError.message || 'Unable to create invitation.');
    }
  };

  const changeRole = async (member, nextRole) => {
    try {
      await updateMyOrganizationMemberRole(organizationId, member.userId || member.user_id, nextRole);
      toast.success('Member role updated.');
      await loadTeam();
    } catch (roleError) {
      toast.error(roleError.message || 'Unable to update member role.');
    }
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.email || member.name || 'this member'} from the organization?`)) return;
    try {
      await removeMyOrganizationMember(organizationId, member.userId || member.user_id);
      toast.success('Member removed.');
      await loadTeam();
    } catch (removeError) {
      toast.error(removeError.message || 'Unable to remove member.');
    }
  };

  const revokeInvitation = async (invitation) => {
    try {
      await revokeMyOrganizationInvitation(organizationId, invitation.id);
      toast.success('Invitation revoked.');
      await loadTeam();
    } catch (revokeError) {
      toast.error(revokeError.message || 'Unable to revoke invitation.');
    }
  };

  return (
    <SurfaceCard className="mt-4 space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Business workspace</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-[var(--tg-text-color)]">
            <UsersRound size={18} aria-hidden="true" /> Team and invitations
          </h3>
          <p className="mt-1 text-sm text-[var(--tg-hint-color)]">{activeOrganization.name} · {organization.role}</p>
        </div>
        <button type="button" onClick={loadTeam} className="rounded-full bg-[var(--tg-secondary-bg-color)] p-3 text-[var(--tg-hint-color)]" aria-label="Refresh organization team">
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>
      {error ? <p className="rounded-2xl bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
        <PremiumInput label="Member email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="teammate@example.com" />
        <PremiumInput as="select" label="Role" value={role} onChange={(event) => setRole(event.target.value)} options={ROLES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))} />
        <TeamButton icon={MailPlus} onClick={inviteMember}>Invite</TeamButton>
      </div>
      {inviteToken ? (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-100">One-time invitation token</p>
          <code className="mt-2 block break-all text-xs font-bold text-amber-50">{inviteToken}</code>
        </div>
      ) : null}
      {loading ? <p className="text-sm font-bold text-[var(--tg-hint-color)]">Loading team…</p> : null}
      {!loading ? (
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.userId || member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--tg-secondary-bg-color)] p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[var(--tg-text-color)]">{member.email || member.name || member.userId}</p>
                <p className="text-xs text-[var(--tg-hint-color)]">{member.status || 'active'} · {member.role}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {member.role !== 'OWNER' ? (
                  <select value={member.role} onChange={(event) => changeRole(member, event.target.value)} className="rounded-xl bg-[var(--tg-bg-color)] px-2 py-2 text-xs font-black text-[var(--tg-text-color)]" aria-label={`Role for ${member.email || member.userId}`}>
                    {ROLES.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
                  </select>
                ) : <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">Owner</span>}
                {member.role !== 'OWNER' ? <TeamButton icon={UserMinus} onClick={() => removeMember(member)}>Remove</TeamButton> : null}
              </div>
            </div>
          ))}
          {!members.length ? <p className="text-sm text-[var(--tg-hint-color)]">No active members found.</p> : null}
        </div>
      ) : null}
      {invitations.length ? (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">Pending invitations</p>
          {invitations.filter((invitation) => invitation.status === 'PENDING').map((invitation) => (
            <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--miniapp-border-color)] p-3 text-sm">
              <span className="truncate font-bold text-[var(--tg-text-color)]">{invitation.email} · {invitation.role}</span>
              <TeamButton icon={ShieldAlert} onClick={() => revokeInvitation(invitation)}>Revoke</TeamButton>
            </div>
          ))}
        </div>
      ) : null}
    </SurfaceCard>
  );
}
