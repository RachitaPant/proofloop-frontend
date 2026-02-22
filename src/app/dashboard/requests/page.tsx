'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { requestApi } from '@/lib/api';
import { Request, RequestStatus } from '@/types';
import Link from 'next/link';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

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

  const getStatusIcon = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.PENDING:
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case RequestStatus.IN_REVIEW:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case RequestStatus.APPROVED:
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case RequestStatus.REJECTED:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const requests = activeTab === 'mine' ? myRequests : pendingRequests;

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Requests</h1>

        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'mine'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Requests ({myRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'pending'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending My Approval ({pendingRequests.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-sm border text-center">
            <p className="text-gray-600">No requests found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/dashboard/requests/${request.id}`}
                className="block bg-white p-6 rounded-lg shadow-sm border hover:border-primary-300 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {getStatusIcon(request.status)}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-900">{request.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{request.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>{request.workflowName}</span>
                        <span>•</span>
                        <span>Created by {request.createdByName}</span>
                        <span>•</span>
                        <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    request.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-800' :
                    request.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-800' :
                    request.status === RequestStatus.IN_REVIEW ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {request.status.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
