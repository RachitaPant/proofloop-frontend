'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { requestApi } from '@/lib/api';
import { Request } from '@/types';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

export default function RequestsPage() {
  const [myRequests, setMyRequests] = useState<Request[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
  const [activeTab, setActiveTab] = useState<'mine' | 'pending'>('mine');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [myRes, pendingRes] = await Promise.all([
        requestApi.getMyRequests(),
        requestApi.getPendingRequests(),
      ]);
      setMyRequests(myRes.data);
      setPendingRequests(pendingRes.data);
    } catch (error) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const requests = activeTab === 'mine' ? myRequests : pendingRequests;

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold text-navy-900">Requests</h1>

        <Tabs
          tabs={[
            { key: 'mine', label: 'My Requests', count: myRequests.length },
            { key: 'pending', label: 'Pending My Approval', count: pendingRequests.length },
          ]}
          active={activeTab}
          onChange={(k) => setActiveTab(k as 'mine' | 'pending')}
        />

        {loading ? (
          <Spinner full />
        ) : requests.length === 0 ? (
          <EmptyState icon={Inbox} title="No requests found" />
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/dashboard/requests/${request.id}`}
                className="block bg-white p-5 rounded-lg border border-surface-200 hover:border-brand-300 hover:shadow-md transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-lg text-navy-900">{request.title}</h3>
                    {request.description && (
                      <p className="text-navy-500 text-sm mt-1 line-clamp-1">{request.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-navy-400">
                      <span>{request.workflowName}</span>
                      <span>&middot;</span>
                      <span>Created by {request.createdByName}</span>
                      <span>&middot;</span>
                      <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <StatusBadge status={request.status} escalated={request.escalated} className="flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
