"use client";

import { useMyRequests, usePendingRequests } from "@/lib/queries";
import { Request, RequestStatus } from "@/types";
import Link from "next/link";
import { ArrowRight, FileText, CheckCircle2, Plus, ClipboardCheck, Users, Zap, LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card className="p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tone}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="text-2xl font-display font-bold text-navy-900">{value}</div>
      <div className="text-sm text-navy-500 mt-0.5">{label}</div>
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
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={request.status} escalated={request.escalated} />
          <ArrowRight className="w-4 h-4 text-navy-300" />
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const mine = useMyRequests();
  const pending = usePendingRequests();
  const myRequests = mine.data ?? [];
  const pendingRequests = pending.data ?? [];

  if (mine.isPending || pending.isPending) {
    return <Spinner full />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">
            Welcome back, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-navy-500 mt-1">Here&rsquo;s what&rsquo;s happening with your approvals today.</p>
        </div>
        <Link href="/dashboard/workflows">
          <Button>
            <Plus className="w-4 h-4" />
            Create Request
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
        <StatTile icon={FileText} label="My Requests" value={myRequests.length} tone="text-brand-600 bg-brand-50" />
        <StatTile
          icon={ClipboardCheck}
          label="Pending My Approval"
          value={pendingRequests.length}
          tone="text-warning-600 bg-warning-50"
        />
        <StatTile
          icon={Users}
          label="Approved"
          value={myRequests.filter((r) => r.status === RequestStatus.APPROVED).length}
          tone="text-success-600 bg-success-50"
        />
        <StatTile
          icon={Zap}
          label="Rejected"
          value={myRequests.filter((r) => r.status === RequestStatus.REJECTED).length}
          tone="text-danger-600 bg-danger-50"
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
  );
}
