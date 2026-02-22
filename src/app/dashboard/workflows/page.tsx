"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { workflowApi, requestApi } from "@/lib/api";
import { Workflow, Role } from "@/types";
import { Plus, Send, Users, Clock } from "lucide-react";
import toast from "react-hot-toast";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [numSteps, setNumSteps] = useState(2);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const { data } = await workflowApi.getAll();
      setWorkflows(data);
    } catch (error) {
      toast.error("Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const steps = [];
    for (let i = 0; i < numSteps; i++) {
      steps.push({
        stepIndex: i,
        stepName: formData.get(`stepName${i}`) as string,
        requiredRole: formData.get(`stepRole${i}`) as Role,
        requiredApprovals:
          parseInt(formData.get(`requiredApprovals${i}`) as string) || 1,
        slaHours: formData.get(`slaHours${i}`)
          ? parseInt(formData.get(`slaHours${i}`) as string)
          : null,
      });
    }

    try {
      await workflowApi.create({
        name: formData.get("name"),
        description: formData.get("description"),
        steps,
      });
      toast.success("Workflow created");
      setShowCreateModal(false);
      loadWorkflows();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create workflow");
    }
  };

  const createRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await requestApi.create({
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        workflowId: selectedWorkflow!.id,
      });
      toast.success("Request created");
      setShowRequestModal(false);
      setSelectedWorkflow(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create request");
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Workflows</h1>
            <p className="text-gray-600 mt-1">Manage approval workflows</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : workflows.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-sm border text-center">
            <p className="text-gray-600">
              No workflows yet. Create your first one!
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white p-6 rounded-lg shadow-sm border"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{workflow.name}</h3>
                    <p className="text-sm text-gray-600">
                      {workflow.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {workflow.steps.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded"
                    >
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-xs">
                        {i + 1}
                      </span>
                      <span className="flex-1">{step.stepName}</span>
                      <div className="flex items-center gap-2">
                        {step.requiredApprovals > 1 && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            <Users className="w-3 h-3" />
                            {step.requiredApprovals}
                          </span>
                        )}
                        {step.slaHours && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                            <Clock className="w-3 h-3" />
                            {step.slaHours}h
                          </span>
                        )}
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {step.requiredRole}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setSelectedWorkflow(workflow);
                    setShowRequestModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"
                >
                  <Send className="w-4 h-4" />
                  Create Request
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create Workflow</h2>
            <form onSubmit={createWorkflow} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  name="name"
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Number of Steps
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numSteps}
                  onChange={(e) => setNumSteps(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Workflow Steps</h3>
                {Array.from({ length: numSteps }, (_, i) => (
                  <div
                    key={i}
                    className="border p-4 rounded-lg space-y-3 bg-gray-50"
                  >
                    <h4 className="font-medium text-sm text-gray-700">
                      Step {i + 1}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Step Name
                        </label>
                        <input
                          name={`stepName${i}`}
                          placeholder={`Step ${i + 1} Name`}
                          required
                          className="w-full px-3 py-2 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Required Role
                        </label>
                        <select
                          name={`stepRole${i}`}
                          required
                          className="w-full px-3 py-2 border rounded text-sm"
                        >
                          <option value={Role.REVIEWER}>Reviewer</option>
                          <option value={Role.ADMIN}>Admin</option>
                          <option value={Role.USER}>User</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Required Approvals
                        </label>
                        <input
                          name={`requiredApprovals${i}`}
                          type="number"
                          min="1"
                          defaultValue="1"
                          className="w-full px-3 py-2 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          SLA Hours (Optional)
                        </label>
                        <input
                          name={`slaHours${i}`}
                          type="number"
                          min="1"
                          placeholder="e.g., 24"
                          className="w-full px-3 py-2 border rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Request Modal - unchanged */}
      {showRequestModal && selectedWorkflow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4">Create Request</h2>
            <p className="text-sm text-gray-600 mb-4">
              Workflow: {selectedWorkflow.name}
            </p>
            <form onSubmit={createRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  name="title"
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
