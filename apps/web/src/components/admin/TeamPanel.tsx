'use client';

import { useState } from 'react';
import { Copy, Crown, Mail, RefreshCw, Trash2, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Role, type CreatedInvite, type EmailStatus, type User } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { getErrorMessage } from '@/lib/errors';
import {
  useCreateInvite,
  useInvites,
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
  useUpdateUserRole,
  useUsers,
} from '@/lib/queries';
import { Card, CardBody } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';

const ROLE_LABEL: Record<Role, string> = { USER: 'Member', REVIEWER: 'Reviewer', ADMIN: 'Admin' };

const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

const DELIVERY: Record<EmailStatus, { tone: 'success' | 'warning'; text: (email: string) => string }> = {
  sent: { tone: 'success', text: (email) => `Invitation emailed to ${email}.` },
  failed: {
    tone: 'warning',
    text: () => "We couldn't send the email. Share the link below with them yourself.",
  },
  not_configured: {
    tone: 'warning',
    text: () => 'Email sending is not set up on this server. Share the link below with them yourself.',
  },
};

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Link copied');
  } catch {
    toast.error('Could not copy. Select the link and copy it manually.');
  }
}

/** Shown after an invite is created or re-sent: the link exists only now. */
function InviteResult({ invite, onDone }: { invite: CreatedInvite; onDone: () => void }) {
  const delivery = DELIVERY[invite.emailStatus];
  return (
    <div className="space-y-4">
      <div
        className={
          delivery.tone === 'success'
            ? 'rounded-md bg-success-50 px-3 py-2.5 text-sm text-success-700'
            : 'rounded-md bg-warning-50 px-3 py-2.5 text-sm text-warning-700'
        }
      >
        {delivery.text(invite.email)}
      </div>
      <div>
        <label htmlFor="invite-link" className="block text-sm font-medium text-navy-700 mb-1.5">
          Invite link
        </label>
        <div className="flex gap-2">
          <input
            id="invite-link"
            readOnly
            value={invite.link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 px-3 py-2 text-sm font-mono bg-surface-50 border border-surface-300 rounded-md text-navy-800"
          />
          <Button variant="outline" onClick={() => copy(invite.link)} aria-label="Copy invite link">
            <Copy className="w-4 h-4" />
            Copy
          </Button>
        </div>
        <p className="text-xs text-navy-400 mt-1.5">
          Works once, for {invite.email} only, and expires in {daysLeft(invite.expiresAt)} days. It isn&rsquo;t shown
          again; re-send the invite to get a new link.
        </p>
      </div>
      <Button className="w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

function InviteForm({ canInviteAdmins, onCreated }: { canInviteAdmins: boolean; onCreated: (i: CreatedInvite) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.USER);
  const create = useCreateInvite();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { email, role },
      {
        onSuccess: onCreated,
        onError: (error) => toast.error(getErrorMessage(error, 'Failed to create invite')),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Email address"
        type="email"
        required
        autoFocus
        placeholder="teammate@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        <option value={Role.USER}>Member: submits requests</option>
        <option value={Role.REVIEWER}>Reviewer: approves requests</option>
        {canInviteAdmins && <option value={Role.ADMIN}>Admin: manages the team and workflows</option>}
      </Select>
      <Button type="submit" className="w-full" loading={create.isPending}>
        <Mail className="w-4 h-4" />
        Send invite
      </Button>
    </form>
  );
}

export default function TeamPanel() {
  const { user: me } = useAuth();
  const isOwner = Boolean(me?.isOwner);
  const { data: users = [] } = useUsers();
  const { data: invites = [] } = useInvites();
  const updateRole = useUpdateUserRole();
  const removeMember = useRemoveMember();
  const resend = useResendInvite();
  const revoke = useRevokeInvite();

  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<CreatedInvite | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);

  const closeInvite = () => {
    setInviting(false);
    setResult(null);
  };

  // Admins manage members and reviewers; admins and the owner are the owner's to manage.
  const canManage = (target: User) => target.id !== me?.id && !target.isOwner && (isOwner || target.role !== Role.ADMIN);

  const changeRole = (target: User, role: Role) =>
    updateRole.mutate(
      { userId: target.id, role },
      {
        onSuccess: (updated) => toast.success(`${updated.name} is now ${ROLE_LABEL[updated.role]}`),
        onError: (error) => toast.error(getErrorMessage(error, 'Failed to update role')),
      },
    );

  const doResend = (id: string) =>
    resend.mutate(id, {
      onSuccess: (invite) => {
        setInviting(true);
        setResult(invite);
      },
      onError: (error) => toast.error(getErrorMessage(error, 'Failed to re-send invite')),
    });

  const doRevoke = (id: string) =>
    revoke.mutate(id, {
      onSuccess: () => toast.success('Invite revoked'),
      onError: (error) => toast.error(getErrorMessage(error, 'Failed to revoke invite')),
    });

  const confirmRemove = () => {
    if (!removing) return;
    removeMember.mutate(removing.id, {
      onSuccess: () => {
        toast.success(`${removing.name} was removed`);
        setRemoving(null);
      },
      onError: (error) => toast.error(getErrorMessage(error, 'Failed to remove member')),
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="font-display font-semibold text-lg text-navy-900">Members</h3>
              <p className="text-sm text-navy-500 mt-1">
                {isOwner
                  ? 'You own this organisation. Only you can grant or remove the admin role.'
                  : 'Admins manage members and reviewers. The owner manages admins.'}
              </p>
            </div>
            <Button onClick={() => setInviting(true)}>
              <UserPlus className="w-4 h-4" />
              Invite someone
            </Button>
          </div>

          <ul className="divide-y divide-surface-100">
            {users.map((u) => (
              <li key={u.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-navy-900">{u.name}</span>
                    {u.isOwner && (
                      <Badge tone="accent">
                        <Crown className="w-3 h-3" />
                        Owner
                      </Badge>
                    )}
                    {u.id === me?.id && <Badge>You</Badge>}
                  </div>
                  <div className="text-sm text-navy-500">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`Role for ${u.name}`}
                    className="w-36"
                    value={u.role}
                    disabled={!canManage(u) || updateRole.isPending}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                  >
                    <option value={Role.USER}>{ROLE_LABEL.USER}</option>
                    <option value={Role.REVIEWER}>{ROLE_LABEL.REVIEWER}</option>
                    <option value={Role.ADMIN} disabled={!isOwner}>
                      {ROLE_LABEL.ADMIN}
                    </option>
                  </Select>
                  {canManage(u) ? (
                    <button
                      onClick={() => setRemoving(u)}
                      className="p-2 rounded-md text-navy-400 hover:bg-danger-50 hover:text-danger-600 transition-colors"
                      aria-label={`Remove ${u.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="w-8" aria-hidden />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-6">
          <h3 className="font-display font-semibold text-lg text-navy-900">Pending invites</h3>
          <p className="text-sm text-navy-500 mt-1 mb-4">Sent but not accepted yet. Each link works once and expires after 7 days.</p>
          {invites.length === 0 ? (
            <EmptyState icon={Mail} title="No pending invites" description="People you invite show up here until they join." />
          ) : (
            <ul className="divide-y divide-surface-100">
              {invites.map((i) => (
                <li key={i.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="font-medium text-navy-900">{i.email}</div>
                    <div className="text-sm text-navy-500">
                      {ROLE_LABEL[i.role]} · expires in {daysLeft(i.expiresAt)} days · invited by {i.createdByName}
                    </div>
                  </div>
                  {(isOwner || i.role !== Role.ADMIN) && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => doResend(i.id)} disabled={resend.isPending}>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Re-send
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => doRevoke(i.id)} disabled={revoke.isPending}>
                        <X className="w-3.5 h-3.5" />
                        Revoke
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={inviting}
        onClose={closeInvite}
        size="sm"
        title={result ? 'Invite ready' : 'Invite someone'}
        description={result ? undefined : 'They get an email with a link to join your organisation.'}
      >
        {result ? (
          <InviteResult invite={result} onDone={closeInvite} />
        ) : (
          <InviteForm canInviteAdmins={isOwner} onCreated={setResult} />
        )}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} size="sm" title={`Remove ${removing?.name ?? ''}?`}>
        <p className="text-sm text-navy-600">
          They lose access immediately and leave any approver groups. What they already approved stays in the audit
          trail. Their own open requests stay in the system.
        </p>
        <div className="flex gap-3 mt-5">
          <Button variant="danger" className="flex-1" loading={removeMember.isPending} onClick={confirmRemove}>
            Remove
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
