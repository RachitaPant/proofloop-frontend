'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ApproverGroup, User } from '@/types';
import { getErrorMessage } from '@/lib/errors';
import { useDeleteGroup, useGroups, useSaveGroup } from '@/lib/queries';
import { Card, CardBody } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';

function GroupForm({
  group,
  users,
  onDone,
}: {
  group: ApproverGroup | null;
  users: User[];
  onDone: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(group?.memberIds ?? []);
  const [filter, setFilter] = useState('');
  const save = useSaveGroup();

  const toggle = (id: string) => setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const visible = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(filter.toLowerCase()));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      { id: group?.id, data: { name, description: description || null, memberIds } },
      {
        onSuccess: (g) => {
          toast.success(group ? `Updated ${g.name}` : `Created ${g.name}`);
          onDone();
        },
        onError: (error) => toast.error(getErrorMessage(error, 'Failed to save group')),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Name" required placeholder="e.g. Finance team" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-navy-700">Members</span>
          <span className="text-xs text-navy-500">{memberIds.length} selected</span>
        </div>
        <Input aria-label="Filter people" placeholder="Filter by name or email" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-surface-200 divide-y divide-surface-100">
          {visible.map((u) => (
            <label key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-surface-50">
              <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggle(u.id)} />
              <span className="font-medium text-navy-900">{u.name}</span>
              <span className="text-navy-500 truncate">{u.email}</span>
              <Badge tone="neutral" className="ml-auto">
                {u.role}
              </Badge>
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" className="flex-1" loading={save.isPending}>
          {group ? 'Save' : 'Create group'}
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Admin section: named groups of people that workflow steps can be assigned
 * to instead of a role (e.g. "Finance team" approves budget requests).
 */
export default function ApproverGroups({ users }: { users: User[] }) {
  const { data: groups = [] } = useGroups();
  const remove = useDeleteGroup();
  const [editing, setEditing] = useState<ApproverGroup | null | 'new'>(null);

  const deleteGroup = (g: ApproverGroup) =>
    remove.mutate(g.id, {
      onSuccess: () => toast.success(`Deleted ${g.name}`),
      onError: (error) => toast.error(getErrorMessage(error, 'Failed to delete group')),
    });

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display font-semibold text-lg text-navy-900">Approver groups</h3>
            <p className="text-sm text-navy-500 mt-1">
              Assign a workflow step to a team instead of a role. Membership changes apply to open requests right away.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="w-3.5 h-3.5" />
            New group
          </Button>
        </div>

        {groups.length === 0 ? (
          <EmptyState icon={Users} title="No approver groups yet" description="e.g. Finance team, Legal, Security." />
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-200 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-navy-900">{g.name}</div>
                  {g.description && <div className="text-xs text-navy-500">{g.description}</div>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {g.members.length === 0 ? (
                      <span className="text-xs text-navy-400">No members</span>
                    ) : (
                      g.members.map((m) => (
                        <Badge key={m.id} tone="neutral">
                          {m.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(g)}>
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${g.name}`}
                    onClick={() => deleteGroup(g)}
                    loading={remove.isPending && remove.variables === g.id}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New approver group' : 'Edit approver group'}
      >
        {editing !== null && (
          <GroupForm group={editing === 'new' ? null : editing} users={users} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </Card>
  );
}
