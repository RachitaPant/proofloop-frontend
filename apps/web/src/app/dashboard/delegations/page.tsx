'use client';

import { useState } from 'react';
import { ArrowRight, CalendarClock, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Delegation } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { getErrorMessage } from '@/lib/errors';
import { useCreateDelegation, useMyDelegations, useRevokeDelegation } from '@/lib/queries';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

const DAY_MS = 24 * 60 * 60 * 1000;
/** yyyy-mm-dd in local time, for <input type="date">. */
const toDateInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

function DelegationRow({ d, direction, onRevoke, revoking }: {
  d: Delegation;
  direction: 'given' | 'received';
  onRevoke?: () => void;
  revoking?: boolean;
}) {
  const other = direction === 'given' ? d.toUserName : d.fromUserName;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-navy-900">
            {direction === 'given' ? 'You' : other}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-navy-400" />
          <span className="font-medium text-navy-900">{direction === 'given' ? other : 'you'}</span>
          <Badge tone="neutral">as {d.role}</Badge>
          {d.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">{d.revokedAt ? 'Ended' : 'Expired'}</Badge>}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-navy-500">
          <CalendarClock className="w-3.5 h-3.5" />
          {new Date(d.startsAt).toLocaleDateString()} – {new Date(d.revokedAt ?? d.endsAt).toLocaleDateString()}
          {d.note && <span className="italic">· &ldquo;{d.note}&rdquo;</span>}
        </div>
      </div>
      {onRevoke && d.active && (
        <Button variant="outline" size="sm" onClick={onRevoke} loading={revoking}>
          End now
        </Button>
      )}
    </div>
  );
}

export default function DelegationsPage() {
  const { user } = useAuth();
  const { data, isPending } = useMyDelegations();
  const create = useCreateDelegation();
  const revoke = useRevokeDelegation();

  const [toEmail, setToEmail] = useState('');
  // Date bounds are fixed when the page opens (reading the clock during render isn't pure).
  const [bounds] = useState(() => ({
    min: toDateInput(new Date()),
    max: toDateInput(new Date(Date.now() + 89 * DAY_MS)),
    initial: toDateInput(new Date(Date.now() + 7 * DAY_MS)),
  }));
  const [until, setUntil] = useState(bounds.initial);
  const [note, setNote] = useState('');

  const hasActive = data?.given.some((d) => d.active) ?? false;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Ends at the end of the chosen day, local time.
    const endsAt = new Date(`${until}T23:59:59`).toISOString();
    create.mutate(
      { toEmail, endsAt, note: note || null },
      {
        onSuccess: (d) => {
          toast.success(`${d.toUserName} can now approve on your behalf`);
          setToEmail('');
          setNote('');
        },
        onError: (error) => toast.error(getErrorMessage(error, 'Failed to create delegation')),
      },
    );
  };

  const endDelegation = (id: string) =>
    revoke.mutate(id, {
      onSuccess: () => toast.success('Delegation ended'),
      onError: (error) => toast.error(getErrorMessage(error, 'Failed to end delegation')),
    });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-navy-900">Delegation</h1>
        <p className="text-navy-500 mt-1">
          Away for a while? Let a colleague approve in your place. They act as your {user?.role.toLowerCase()} role on
          approval steps only, every action they take is recorded as &ldquo;on behalf of&rdquo; you, and it ends
          automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delegate my approvals</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {hasActive ? (
            <p className="text-sm text-navy-500">You already have an active delegation. End it below to create a new one.</p>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Colleague's email"
                type="email"
                required
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
              />
              <Input
                label="Until (inclusive)"
                type="date"
                required
                min={bounds.min}
                max={bounds.max}
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
              <div className="sm:col-span-2">
                <Input label="Note (optional)" placeholder="e.g. On leave" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" loading={create.isPending}>
                  <UserCheck className="w-4 h-4" />
                  Delegate
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      {isPending ? (
        <Spinner full />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-display font-semibold text-navy-900">Delegations you&rsquo;ve given</h2>
            {data?.given.length ? (
              data.given.map((d) => (
                <DelegationRow
                  key={d.id}
                  d={d}
                  direction="given"
                  onRevoke={() => endDelegation(d.id)}
                  revoking={revoke.isPending && revoke.variables === d.id}
                />
              ))
            ) : (
              <EmptyState icon={UserCheck} title="You haven't delegated your approvals" />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-display font-semibold text-navy-900">Delegated to you</h2>
            {data?.received.length ? (
              data.received.map((d) => <DelegationRow key={d.id} d={d} direction="received" />)
            ) : (
              <EmptyState icon={UserCheck} title="Nobody has delegated approvals to you" />
            )}
          </section>
        </>
      )}
    </div>
  );
}
