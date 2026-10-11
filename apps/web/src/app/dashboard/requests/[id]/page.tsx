"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { stageOf } from "@proofloop/shared";
import { RequestStatus } from "@/types";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, SearchX, UserCheck } from "lucide-react";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/errors";
import { useRequest, useRequestAction, useVerifyChain, useWorkflow, type RequestAction } from "@/lib/queries";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import WorkflowStepList, { type StepState } from "@/components/workflow/WorkflowStepList";
import AuditTrail from "@/components/workflow/AuditTrail";
import { cn } from "@/lib/cn";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [comment, setComment] = useState("");
  const [chosenStep, setChosenStep] = useState<number | null>(null);

  const requestQuery = useRequest(id);
  const request = requestQuery.data;
  const workflowQuery = useWorkflow(request?.workflowId);
  const workflow = workflowQuery.data;

  const action = useRequestAction(id);
  const verify = useVerifyChain(id);
  const verification = verify.data;

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

  // What the viewer may act on comes from the API (it knows roles, delegations
  // and who already acted), so the page doesn't re-derive eligibility.
  const actionable = request.actionableSteps ?? [];
  const selected = actionable.find((a) => a.stepIndex === chosenStep) ?? actionable[0];

  const stageOfStep = (i: number) => stageOf(workflow.steps[i]!, i);
  const approvals = (i: number) => (request.stepApprovals[i] ?? []).length;
  const stateFor = (i: number): StepState => {
    if (request.skippedSteps.includes(i)) return "skipped";
    if (request.status === RequestStatus.APPROVED) return "complete";
    const stage = stageOfStep(i);
    if (stage < request.currentStep) return "complete";
    if (stage > request.currentStep) return "pending";
    if (approvals(i) >= workflow.steps[i]!.requiredApprovals) return "complete";
    return request.status === RequestStatus.REJECTED ? "pending" : "current";
  };
  const isEscalated = (i: number) =>
    request.escalatedSteps.includes(i) ||
    (request.escalated && request.escalatedSteps.length === 0 && stageOfStep(i) === request.currentStep);

  const handleAction = (kind: RequestAction) => {
    if (!selected) return;
    action.mutate(
      { action: kind, comment, stepIndex: selected.stepIndex },
      {
        onSuccess: () => {
          toast.success(kind === "approve" ? "Request approved" : "Request rejected");
          setComment("");
          setChosenStep(null);
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

  const fieldEntries = workflow.fields
    .filter((f) => request.fields?.[f.key] !== undefined)
    .map((f) => ({ label: f.label, value: request.fields[f.key] }));

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
                fields={workflow.fields}
                stateFor={stateFor}
                approvalsFor={approvals}
                isEscalated={isEscalated}
              />
            </CardBody>
          </Card>

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle>Take Action</CardTitle>
              </CardHeader>
              <CardBody className="pt-0 space-y-4">
                {actionable.length > 1 && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm text-navy-600 mb-1">Several steps are waiting for you. Which one?</legend>
                    {actionable.map((a) => (
                      <label
                        key={a.stepIndex}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer",
                          a.stepIndex === selected.stepIndex ? "border-brand-300 bg-brand-50" : "border-surface-200",
                        )}
                      >
                        <input
                          type="radio"
                          name="step"
                          checked={a.stepIndex === selected.stepIndex}
                          onChange={() => setChosenStep(a.stepIndex)}
                        />
                        {workflow.steps[a.stepIndex]?.stepName}
                      </label>
                    ))}
                  </fieldset>
                )}
                {selected.onBehalfOf && (
                  <div className="flex items-center gap-2 rounded-md bg-accent-50 px-3 py-2 text-sm text-accent-700">
                    <UserCheck className="w-4 h-4 shrink-0" />
                    You&rsquo;re acting on behalf of {selected.onBehalfOf.name} (delegated). This is recorded in the audit
                    trail.
                  </div>
                )}
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
                <AuditTrail history={request.history} steps={workflow.steps} />
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
              {fieldEntries.map(({ label, value }) => (
                <div key={label}>
                  <span className="text-navy-500">{label}</span>
                  <div className="mt-1 font-medium text-navy-900">
                    {typeof value === "number" ? value.toLocaleString() : value}
                  </div>
                </div>
              ))}
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
