"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { requestApi, workflowApi } from "@/lib/api";
import { Request, Workflow, RequestStatus } from "@/types";
import {
  CheckCircle2,
  XCircle,
  Users,
  AlertTriangle,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";

export default function RequestDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);

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
    try {
      await requestApi.approve(params.id as string, comment);
      toast.success("Request approved");
      loadRequest();
      setComment("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to approve");
    }
  };

  const handleReject = async () => {
    try {
      await requestApi.reject(params.id as string, comment);
      toast.success("Request rejected");
      loadRequest();
      setComment("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reject");
    }
  };

  if (loading || !request || !workflow) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  const canTakeAction = () => {
    if (
      request.status === RequestStatus.APPROVED ||
      request.status === RequestStatus.REJECTED
    ) {
      return false;
    }
    if (request.currentStep >= workflow.steps.length) {
      return false;
    }
    const currentStepRole = workflow.steps[request.currentStep].requiredRole;

    // Check if user hasn't already approved this step
    const stepApprovers = request.stepApprovals[request.currentStep] || [];
    const alreadyApproved = stepApprovers.includes(user?.id || "");

    return user?.role === currentStepRole && !alreadyApproved;
  };

  const canAct = canTakeAction();

  // Get approval progress for a step
  const getApprovalProgress = (stepIndex: number) => {
    const step = workflow.steps[stepIndex];
    const approvers = request.stepApprovals[stepIndex] || [];
    return {
      current: approvers.length,
      required: step.requiredApprovals,
      percentage: (approvers.length / step.requiredApprovals) * 100,
    };
  };

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{request.title}</h1>
            {request.escalated && (
              <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />
                Escalated
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">{request.workflowName}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-gray-700">
                {request.description || "No description provided"}
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-semibold mb-4">Workflow Progress</h3>
              <div className="space-y-4">
                {workflow.steps.map((step, i) => {
                  const isComplete =
                    i < request.currentStep ||
                    request.status === RequestStatus.APPROVED;
                  const isCurrent = i === request.currentStep && canAct;
                  const progress = getApprovalProgress(i);

                  return (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border ${isCurrent ? "bg-primary-50 border-primary-200" : "bg-white"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isComplete ? "bg-green-500" : isCurrent ? "bg-primary-500" : "bg-gray-200"}`}
                        >
                          {isComplete ? (
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          ) : (
                            <span
                              className={`text-sm font-medium ${isCurrent ? "text-white" : "text-gray-600"}`}
                            >
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{step.stepName}</div>
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {step.requiredRole}
                            </span>
                            {step.slaHours && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                                SLA: {step.slaHours}h
                              </span>
                            )}
                          </div>

                          {/* Parallel Approval Progress */}
                          {step.requiredApprovals > 1 && (
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                <Users className="w-4 h-4" />
                                <span>
                                  {progress.current} / {progress.required}{" "}
                                  approvals
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-primary-600 h-2 rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(progress.percentage, 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canAct && (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="font-semibold mb-4">Take Action</h3>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment (optional)"
                  className="w-full px-4 py-2 border rounded-lg mb-4"
                  rows={3}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={handleReject}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            )}

            {request.history.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-semibold">Audit History</h3>
                  <Shield className="w-4 h-4 text-primary-600" />
                  Tamper-evident with hash chain
                </div>
                <div className="space-y-3">
                  {request.history.map((action, i) => (
                    <div key={i} className="border-l-2 border-gray-200 pl-4">
                      <div className="flex items-center gap-2">
                        {action.action === "APPROVED" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="font-medium">{action.action}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        by {action.actedByName} •{" "}
                        {new Date(action.timestamp).toLocaleString()}
                      </div>
                      {action.comment && (
                        <div className="text-sm text-gray-700 mt-1 italic">
                          {action.comment}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-1 font-mono">
                        Hash: {action.currentHash.substring(0, 16)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-semibold mb-4">Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600">Status</span>
                  <div
                    className={`mt-1 px-3 py-1 rounded-full text-xs font-medium inline-block ${
                      request.status === RequestStatus.APPROVED
                        ? "bg-green-100 text-green-800"
                        : request.status === RequestStatus.REJECTED
                          ? "bg-red-100 text-red-800"
                          : request.status === RequestStatus.IN_REVIEW
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {request.status.replace("_", " ")}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Created by</span>
                  <div className="mt-1 font-medium">
                    {request.createdByName}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Created</span>
                  <div className="mt-1">
                    {new Date(request.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Last updated</span>
                  <div className="mt-1">
                    {new Date(request.updatedAt).toLocaleString()}
                  </div>
                </div>
                {request.escalated && (
                  <div className="pt-3 border-t">
                    <span className="text-red-600 font-medium">
                      ⚠ Escalated to ADMIN
                    </span>
                    {request.originalRequiredRole && (
                      <div className="text-xs text-gray-600 mt-1">
                        Originally: {request.originalRequiredRole}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
