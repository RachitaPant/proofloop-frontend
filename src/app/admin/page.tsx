'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { adminApi } from '@/lib/api';
import { Analytics } from '@/types';
import { BarChart3, Users, Workflow, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const { data } = await adminApi.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Analytics</h1>
          <p className="text-gray-600 mt-1">System-wide statistics and insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-primary-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{analytics.totalUsers}</div>
            <div className="text-sm text-gray-600 mt-1">Total Users</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-2">
              <Workflow className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{analytics.totalWorkflows}</div>
            <div className="text-sm text-gray-600 mt-1">Active Workflows</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{analytics.totalRequests}</div>
            <div className="text-sm text-gray-600 mt-1">Total Requests</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {analytics.totalRequests > 0 
                ? Math.round((analytics.approvedRequests / analytics.totalRequests) * 100) 
                : 0}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Approval Rate</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="font-semibold text-lg mb-4">Request Status Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Pending</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500"
                      style={{ width: `${(analytics.pendingRequests / analytics.totalRequests) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{analytics.pendingRequests}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-700">In Review</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500"
                      style={{ width: `${(analytics.inReviewRequests / analytics.totalRequests) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{analytics.inReviewRequests}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-700">Approved</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500"
                      style={{ width: `${(analytics.approvedRequests / analytics.totalRequests) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{analytics.approvedRequests}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-700">Rejected</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500"
                      style={{ width: `${(analytics.rejectedRequests / analytics.totalRequests) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{analytics.rejectedRequests}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="font-semibold text-lg mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Active Requests</span>
                <span className="text-2xl font-bold text-primary-600">
                  {analytics.pendingRequests + analytics.inReviewRequests}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Completed Requests</span>
                <span className="text-2xl font-bold text-green-600">
                  {analytics.approvedRequests + analytics.rejectedRequests}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg. Workflow Steps</span>
                <span className="text-2xl font-bold text-gray-900">2.5</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
