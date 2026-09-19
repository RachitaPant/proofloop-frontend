"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { requestApi } from "@/lib/api";
import { Request, RequestStatus } from "@/types";
import Link from "next/link";
import { ArrowRight, FileText, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

function StatTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="p-6">
      <div className="text-sm text-navy-500">{label}</div>
      <div className={`text-3xl font-display font-bold mt-2 ${tone ?? "text-navy-900"}`}>{value}</div>
    </Card>
  );
}

function RequestRow({ request }: { request: Request }) {
  return (
    <Link
      href={`/dashboard/requests/${request.id}`}
      className="block bg-white p-4 rounded-lg border border-surface-200 hover:border-brand-300 hover:shadow-md transition-all duration-150"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-navy-900 truncate">{request.title}</h3>
          <p className="text-sm text-navy-500 truncate">
            {request.workflowName} &middot; Created by {request.createdByName}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={request.status} escalated={request.escalated} />
          <ArrowRight className="w-4 h-4 text-navy-300" />
        </div>
      </div>
    </Link>
  );
}

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

  if (loading) {
    return (
      <ProtectedRoute>
        <Spinner full />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-navy-900">Dashboard</h1>
          <p className="text-navy-500 mt-1">Overview of your requests and pending approvals</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <StatTile label="My Requests" value={myRequests.length} />
          <StatTile label="Pending My Approval" value={pendingRequests.length} tone="text-brand-600" />
          <StatTile
            label="Approved"
            value={myRequests.filter((r) => r.status === RequestStatus.APPROVED).length}
            tone="text-success-600"
          />
          <StatTile
            label="Rejected"
            value={myRequests.filter((r) => r.status === RequestStatus.REJECTED).length}
            tone="text-danger-600"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-semibold text-navy-900">Pending My Approval</h2>
            {pendingRequests.length > 0 && (
              <Link href="/dashboard/requests" className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                View all
              </Link>
            )}
          </div>

          {pendingRequests.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No requests pending your approval" />
          ) : (
            <div className="space-y-3">
              {pendingRequests.slice(0, 5).map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-semibold text-navy-900">My Recent Requests</h2>
            {myRequests.length > 0 && (
              <Link href="/dashboard/requests" className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                View all
              </Link>
            )}
          </div>

          {myRequests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="You haven't created any requests yet"
              action={
                <Link href="/dashboard/workflows">
                  <Button>Create Request</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {myRequests.slice(0, 5).map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
