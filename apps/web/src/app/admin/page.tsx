'use client';

import { Analytics, Role, User } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { getErrorMessage } from '@/lib/errors';
import { useAnalytics, useUpdateUserRole, useUsers } from '@/lib/queries';
import { BarChart3, Users, Workflow, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardBody } from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import ProgressBar from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';

const STAT_TILES = (a: Analytics) => [
  { icon: Users, iconTone: 'text-brand-600 bg-brand-50', value: a.totalUsers, label: 'Total Users' },
  { icon: Workflow, iconTone: 'text-accent-600 bg-accent-50', value: a.totalWorkflows, label: 'Active Workflows' },
  { icon: FileText, iconTone: 'text-success-600 bg-success-50', value: a.totalRequests, label: 'Total Requests' },
  {
    icon: BarChart3,
    iconTone: 'text-warning-600 bg-warning-50',
    value: a.totalRequests > 0 ? `${Math.round((a.approvedRequests / a.totalRequests) * 100)}%` : '0%',
    label: 'Approval Rate',
  },
];

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const { data: analytics, isError } = useAnalytics();
  const { data: users = [] } = useUsers();
  const updateRole = useUpdateUserRole();
  const savingUserId = updateRole.isPending ? updateRole.variables?.userId : undefined;

  const changeRole = (target: User, role: Role) =>
    updateRole.mutate(
      { userId: target.id, role },
      {
        onSuccess: (updated) => toast.success(`${updated.name} is now ${updated.role}`),
        onError: (error) => toast.error(getErrorMessage(error, 'Failed to update role')),
      },
    );

  if (!analytics) {
    return isError ? (
      <EmptyState icon={BarChart3} title="Analytics are unavailable right now" description="Try refreshing the page." />
    ) : (
      <Spinner full />
    );
  }

  const total = analytics.totalRequests || 1;
  const breakdown = [
    { label: 'Pending', value: analytics.pendingRequests, tone: 'warning' as const },
    { label: 'In Review', value: analytics.inReviewRequests, tone: 'brand' as const },
    { label: 'Approved', value: analytics.approvedRequests, tone: 'success' as const },
    { label: 'Rejected', value: analytics.rejectedRequests, tone: 'danger' as const },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-navy-900">Admin Analytics</h1>
        <p className="text-navy-500 mt-1">System-wide statistics and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {STAT_TILES(analytics).map(({ icon: Icon, iconTone, value, label }) => (
          <Card key={label} className="p-6">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${iconTone}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-3xl font-display font-bold text-navy-900">{value}</div>
            <div className="text-sm text-navy-500 mt-1">{label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <h3 className="font-display font-semibold text-lg text-navy-900 mb-4">Request Status Breakdown</h3>
            <div className="space-y-4">
              {breakdown.map(({ label, value, tone }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-navy-700">{label}</span>
                    <span className="font-medium text-navy-900">{value}</span>
                  </div>
                  <ProgressBar value={value} max={total} tone={tone} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="font-display font-semibold text-lg text-navy-900 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-surface-200">
                <span className="text-navy-500">Active Requests</span>
                <span className="text-2xl font-display font-bold text-brand-600">
                  {analytics.pendingRequests + analytics.inReviewRequests}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-surface-200">
                <span className="text-navy-500">Completed Requests</span>
                <span className="text-2xl font-display font-bold text-success-600">
                  {analytics.approvedRequests + analytics.rejectedRequests}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-navy-500">Total Workflows</span>
                <span className="text-2xl font-display font-bold text-navy-900">{analytics.totalWorkflows}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h3 className="font-display font-semibold text-lg text-navy-900">Users &amp; Roles</h3>
          <p className="text-sm text-navy-500 mt-1 mb-4">
            New sign-ups are always Users. Grant Reviewer or Admin access here.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-navy-500 border-b border-surface-200">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 font-medium w-44">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-surface-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-navy-900">{u.name}</td>
                    <td className="py-2.5 pr-4 text-navy-600">{u.email}</td>
                    <td className="py-2.5">
                      <Select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        disabled={u.id === currentUser?.id || savingUserId === u.id}
                        onChange={(e) => changeRole(u, e.target.value as Role)}
                      >
                        <option value={Role.USER}>User</option>
                        <option value={Role.REVIEWER}>Reviewer</option>
                        <option value={Role.ADMIN}>Admin</option>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
