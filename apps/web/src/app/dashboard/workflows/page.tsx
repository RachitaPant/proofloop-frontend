"use client";

import { useState } from "react";
import { Plus, Send, GitBranch, ListChecks } from "lucide-react";
import type { Workflow } from "@/types";
import { useWorkflows } from "@/lib/queries";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import WorkflowStepList from "@/components/workflow/WorkflowStepList";
import WorkflowBuilder from "@/components/workflow/WorkflowBuilder";
import RequestForm from "@/components/workflow/RequestForm";

export default function WorkflowsPage() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [requestFor, setRequestFor] = useState<Workflow | null>(null);
  const { data: workflows = [], isPending } = useWorkflows();

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-navy-900">Workflows</h1>
            <p className="text-navy-500 mt-1">Manage approval workflows</p>
          </div>
          <Button onClick={() => setShowBuilder(true)}>
            <Plus className="w-4 h-4" />
            New Workflow
          </Button>
        </div>

        {isPending ? (
          <Spinner full />
        ) : workflows.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No workflows yet"
            description="Create your first approval workflow to get started."
            action={<Button onClick={() => setShowBuilder(true)}>New Workflow</Button>}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <h3 className="font-display font-bold text-lg text-navy-900">{workflow.name}</h3>
                  {workflow.description && <p className="text-sm text-navy-500 mt-0.5">{workflow.description}</p>}
                  {workflow.fields.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <ListChecks className="w-3.5 h-3.5 text-navy-400" />
                      {workflow.fields.map((f) => (
                        <Badge key={f.key} tone="neutral">
                          {f.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardBody className="pt-0 flex-1">
                  <WorkflowStepList steps={workflow.steps} fields={workflow.fields} compact />
                </CardBody>
                <CardFooter>
                  <Button variant="outline" className="w-full" onClick={() => setRequestFor(workflow)}>
                    <Send className="w-4 h-4" />
                    Create Request
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={showBuilder} onClose={() => setShowBuilder(false)} title="Create Workflow" size="lg">
        {showBuilder && <WorkflowBuilder onCreated={() => setShowBuilder(false)} onCancel={() => setShowBuilder(false)} />}
      </Modal>

      <Modal
        open={!!requestFor}
        onClose={() => setRequestFor(null)}
        title="Create Request"
        description={requestFor ? `Workflow: ${requestFor.name}` : undefined}
        size={requestFor?.steps.some((s) => s.condition) ? "md" : "sm"}
      >
        {requestFor && (
          <RequestForm workflow={requestFor} onCreated={() => setRequestFor(null)} onCancel={() => setRequestFor(null)} />
        )}
      </Modal>
    </>
  );
}
