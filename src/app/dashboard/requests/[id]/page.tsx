"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { requestApi, workflowApi } from "@/lib/api";
import { Request, Workflow, RequestStatus } from "@/types";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import WorkflowStepList from "@/components/workflow/WorkflowStepList";
import AuditTrail from "@/components/workflow/AuditTrail";

export default function RequestDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRequest();
  }, [params.id]);

  const loadRequest = async () => {
    try {
      const { data } = await requestApi.getById(params.id as string);
      setRequest(data);
      const wf = await workflowApi.getById(data.workflowId);
      setWorkflow(wf.data);
    } catch (error) {
      toast.error("Failed to load request");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await requestApi.approve(params.id as string, comment);
      toast.success("Request approved");
      await loadRequest();
      setComment("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to approve");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await requestApi.reject(params.id as string, comment);
      toast.success("Request rejected");
      await loadRequest();
      setComment("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reject");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !request || !workflow) {
    return (
      <ProtectedRoute>
        <Spinner full />
      </ProtectedRoute>
    );
  }

  const canTakeAction = () => {
    if (request.status === RequestStatus.APPROVED || request.status === RequestStatus.REJECTED) {
      return false;
    }
    if (request.currentStep >= workflow.steps.length) {
      return false;
    }
    const currentStepRole = workflow.steps[request.currentStep].requiredRole;
    const stepApprovers = request.stepApprovals[request.currentStep] || [];
    const alreadyApproved = stepApprovers.includes(user?.id || "");

    return user?.role === currentStepRole && !alreadyApproved;
  };

  const canAct = canTakeAction();

  return (
    <ProtectedRoute>
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
                  isCurrent={(i) => i === request.currentStep && canAct}
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
                    <Button variant="success" className="flex-1" onClick={handleApprove} loading={submitting}>
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button variant="danger" className="flex-1" onClick={handleReject} loading={submitting}>
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {request.history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Audit History</CardTitle>
                </CardHeader>
                <CardBody className="pt-0">
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
    </ProtectedRoute>
  );
}
