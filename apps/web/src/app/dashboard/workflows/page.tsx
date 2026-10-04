"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { workflowApi, requestApi } from "@/lib/api";
import { Workflow, Role } from "@/types";
import { Plus, Send, GitBranch } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Textarea, Select, Label } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import WorkflowStepList from "@/components/workflow/WorkflowStepList";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
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
        requiredApprovals: parseInt(formData.get(`requiredApprovals${i}`) as string) || 1,
        slaHours: formData.get(`slaHours${i}`) ? parseInt(formData.get(`slaHours${i}`) as string) : null,
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
            <h1 className="text-3xl font-display font-bold text-navy-900">Workflows</h1>
            <p className="text-navy-500 mt-1">Manage approval workflows</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            New Workflow
          </Button>
        </div>

        {loading ? (
          <Spinner full />
        ) : workflows.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No workflows yet"
            description="Create your first approval workflow to get started."
            action={<Button onClick={() => setShowCreateModal(true)}>New Workflow</Button>}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <h3 className="font-display font-bold text-lg text-navy-900">{workflow.name}</h3>
                  {workflow.description && <p className="text-sm text-navy-500 mt-0.5">{workflow.description}</p>}
                </CardHeader>
                <CardBody className="pt-0 flex-1">
                  <WorkflowStepList steps={workflow.steps} compact />
                </CardBody>
                <CardFooter>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedWorkflow(workflow);
                      setShowRequestModal(true);
                    }}
                  >
                    <Send className="w-4 h-4" />
                    Create Request
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Workflow" size="lg">
        <form onSubmit={createWorkflow} className="space-y-5">
          <Input name="name" label="Name" required />
          <Textarea name="description" label="Description" rows={3} />
          <Input
            type="number"
            min="1"
            max="10"
            label="Number of Steps"
            value={numSteps}
            onChange={(e) => setNumSteps(parseInt(e.target.value) || 1)}
          />

          <div className="space-y-3">
            <h3 className="font-semibold text-navy-800 text-sm">Workflow Steps</h3>
            {Array.from({ length: numSteps }, (_, i) => (
              <div key={i} className="border border-surface-200 p-4 rounded-lg space-y-3 bg-surface-50">
                <h4 className="font-medium text-xs text-navy-500 uppercase tracking-wide">Step {i + 1}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input name={`stepName${i}`} placeholder={`Step ${i + 1} name`} required label="Step Name" />
                  <Select name={`stepRole${i}`} required label="Required Role" defaultValue={Role.REVIEWER}>
                    <option value={Role.REVIEWER}>Reviewer</option>
                    <option value={Role.ADMIN}>Admin</option>
                    <option value={Role.USER}>User</option>
                  </Select>
                  <Input
                    name={`requiredApprovals${i}`}
                    type="number"
                    min="1"
                    defaultValue="1"
                    label="Required Approvals"
                  />
                  <Input name={`slaHours${i}`} type="number" min="1" placeholder="e.g. 24" label="SLA Hours (optional)" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" className="flex-1">
              Create
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showRequestModal && !!selectedWorkflow}
        onClose={() => setShowRequestModal(false)}
        title="Create Request"
        description={selectedWorkflow ? `Workflow: ${selectedWorkflow.name}` : undefined}
        size="sm"
      >
        <form onSubmit={createRequest} className="space-y-4">
          <Input name="title" label="Title" required />
          <Textarea name="description" label="Description" rows={4} />
          <div className="flex gap-3 pt-1">
            <Button type="submit" className="flex-1">
              Create
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowRequestModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </ProtectedRoute>
  );
}
