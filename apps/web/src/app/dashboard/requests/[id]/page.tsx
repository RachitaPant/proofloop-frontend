"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { RequestStatus, Role } from "@/types";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, SearchX } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { useRequest, useRequestAction, useVerifyChain, useWorkflow, type RequestAction } from "@/lib/queries";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import WorkflowStepList from "@/components/workflow/WorkflowStepList";
import AuditTrail from "@/components/workflow/AuditTrail";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [comment, setComment] = useState("");

  const requestQuery = useRequest(id);
  const request = requestQuery.data;
  const workflowQuery = useWorkflow(request?.workflowId);
  const workflow = workflowQuery.data;

  const action = useRequestAction(id);
  const verify = useVerifyChain(id);
  const verification = verify.data;

  const handleAction = (kind: RequestAction) => {
    action.mutate(
      { action: kind, comment },
      {
        onSuccess: () => {
          toast.success(kind === "approve" ? "Request approved" : "Request rejected");
          setComment("");
          // The chain just grew; an earlier verification result no longer describes it.
          verify.reset();
        },
        onError: (error) => toast.error(getErrorMessage(error, `Failed to ${kind}`)),
      },
    );
  };

  const handleVerify = () =>
    verify.mutate(undefined, {
      onError: (error) => toast.error(getErrorMessage(error, "Failed to verify audit chain")),
    });

  if (requestQuery.isError || workflowQuery.isError) {
    return (
      <EmptyState
        icon={SearchX}
        title="Request not found"
        description="It may have been removed, or you may not have access to it."
      />
    );
  }

  if (!request || !workflow) {
    return <Spinner full />;
  }

  const canTakeAction = () => {
    if (request.status === RequestStatus.APPROVED || request.status === RequestStatus.REJECTED) {
      return false;
    }
    if (request.currentStep >= workflow.steps.length) {
      return false;
    }
    if (request.createdBy === user?.id) {
      return false;
    }
    // An SLA-escalated request's current step is routed to ADMIN.
    const currentStepRole = request.escalated ? Role.ADMIN : workflow.steps[request.currentStep].requiredRole;
    const stepApprovers = request.stepApprovals[request.currentStep] || [];
    const alreadyApproved = stepApprovers.includes(user?.id || "");

    return user?.role === currentStepRole && !alreadyApproved;
  };

  const canAct = canTakeAction();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-display font-bold text-navy-900">{request.title}</h1>
          {request.escalated && (
            <span className="flex items-center gap-1 px-3 py-1 bg-danger-50 text-danger-700 rounded-full text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              Escalated
            </span>
          )}
        </div>
        <p className="text-navy-500 mt-1">{request.workflowName}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <p className="text-navy-700">{request.description || "No description provided"}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow Progress</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <WorkflowStepList
                steps={workflow.steps}
                isComplete={(i) => i < request.currentStep || request.status === RequestStatus.APPROVED}
                isCurrent={(i) =>
                  i === request.currentStep &&
                  (request.status === RequestStatus.PENDING || request.status === RequestStatus.IN_REVIEW)
                }
                approvalsFor={(i) => (request.stepApprovals[i] || []).length}
              />
            </CardBody>
          </Card>

          {canAct && (
            <Card>
              <CardHeader>
                <CardTitle>Take Action</CardTitle>
              </CardHeader>
              <CardBody className="pt-0 space-y-4">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment (optional)"
                  rows={3}
                />
                <div className="flex gap-3">
                  <Button
                    variant="success"
                    className="flex-1"
                    onClick={() => handleAction("approve")}
                    loading={action.isPending && action.variables?.action === "approve"}
                    disabled={action.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => handleAction("reject")}
                    loading={action.isPending && action.variables?.action === "reject"}
                    disabled={action.isPending}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {request.history.length > 0 && (
            <Card>
              <CardHeader className="flex items-center justify-between gap-3">
                <CardTitle>Audit History</CardTitle>
                <Button variant="secondary" size="sm" onClick={handleVerify} loading={verify.isPending}>
                  <ShieldCheck className="w-4 h-4" />
                  Verify chain
                </Button>
              </CardHeader>
              <CardBody className="pt-0 space-y-4">
                {verification &&
                  (verification.valid ? (
                    <div className="flex items-start gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2.5 text-sm text-success-700">
                      <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium">
                          Chain intact:{" "}
                          {verification.length === 1
                            ? "the entry matches its hash"
                            : `all ${verification.length} entries match their hashes`}
                        </div>
                        <div className="font-mono text-xs break-all opacity-80">head {verification.headHash}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
                      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-medium">
                          Verification failed at entry #{(verification.brokenAtIndex ?? 0) + 1}
                        </div>
                        <div className="text-xs">{verification.reason}</div>
                      </div>
                    </div>
                  ))}
                <AuditTrail history={request.history} />
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardBody className="pt-0 space-y-4 text-sm">
              <div>
                <span className="text-navy-500">Status</span>
                <div className="mt-1.5">
                  <StatusBadge status={request.status} escalated={request.escalated} />
                </div>
              </div>
              <div>
                <span className="text-navy-500">Created by</span>
                <div className="mt-1 font-medium text-navy-900">{request.createdByName}</div>
              </div>
              <div>
                <span className="text-navy-500">Created</span>
                <div className="mt-1 text-navy-700">{new Date(request.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-navy-500">Last updated</span>
                <div className="mt-1 text-navy-700">{new Date(request.updatedAt).toLocaleString()}</div>
              </div>
              {request.escalated && (
                <div className="pt-3 border-t border-surface-200">
                  <Badge tone="danger">Escalated to ADMIN</Badge>
                  {request.originalRequiredRole && (
                    <div className="text-xs text-navy-500 mt-1.5">
                      Originally required: {request.originalRequiredRole}
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
