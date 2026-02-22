"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { requestApi } from "@/lib/api";
import { Request, RequestStatus } from "@/types";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Dashboard() {
  const [myRequests, setMyRequests] = useState<Request[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
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
      toast.error("Failed to load data");
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

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case RequestStatus.IN_REVIEW:
        return "bg-blue-100 text-blue-800";
      case RequestStatus.APPROVED:
        return "bg-green-100 text-green-800";
      case RequestStatus.REJECTED:
        return "bg-red-100 text-red-800";
    }
  };

  if (loading) {
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Overview of your requests and pending approvals
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600">My Requests</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {myRequests.length}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600">Pending My Approval</div>
            <div className="text-3xl font-bold text-primary-600 mt-2">
              {pendingRequests.length}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600">Approved</div>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {
                myRequests.filter((r) => r.status === RequestStatus.APPROVED)
                  .length
              }
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600">Rejected</div>
            <div className="text-3xl font-bold text-red-600 mt-2">
              {
                myRequests.filter((r) => r.status === RequestStatus.REJECTED)
                  .length
              }
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Pending My Approval
            </h2>
            {pendingRequests.length > 0 && (
              <Link
                href="/dashboard/requests"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View all
              </Link>
            )}
          </div>

          {pendingRequests.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
              <CheckCircle2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No requests pending your approval</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.slice(0, 5).map((request) => (
                <Link
                  key={request.id}
                  href={`/dashboard/requests/${request.id}`}
                  className="block bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(request.status)}
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {request.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {request.workflowName} • Created by{" "}
                            {request.createdByName}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}
                      >
                        {request.status.replace("_", " ")}
                      </span>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My Requests */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              My Recent Requests
            </h2>
            {myRequests.length > 0 && (
              <Link
                href="/dashboard/requests"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View all
              </Link>
            )}
          </div>

          {myRequests.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">
                You haven't created any requests yet
              </p>
              <Link
                href="/dashboard/workflows"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                Create Request
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.slice(0, 5).map((request) => (
                <Link
                  key={request.id}
                  href={`/dashboard/requests/${request.id}`}
                  className="block bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(request.status)}
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {request.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {request.workflowName}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}
                      >
                        {request.status.replace("_", " ")}
                      </span>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
