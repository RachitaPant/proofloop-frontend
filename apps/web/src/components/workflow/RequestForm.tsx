'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { planSkippedSteps, validateFieldValues } from '@proofloop/shared';
import type { Workflow } from '@/types';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import WorkflowStepList from '@/components/workflow/WorkflowStepList';
import { getErrorMessage } from '@/lib/errors';
import { useCreateRequest } from '@/lib/queries';

/**
 * New-request form for a workflow: title, description and the workflow's own
 * fields, with a live preview of the approval route those values produce
 * (the same routing rules the API applies).
 */
export default function RequestForm({
  workflow,
  onCreated,
  onCancel,
}: {
  workflow: Workflow;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const createRequest = useCreateRequest();

  const { values, errors } = validateFieldValues(workflow.fields, raw);
  const skipped = planSkippedSteps(workflow.steps, values);
  const conditional = workflow.steps.some((s) => s.condition);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    createRequest.mutate(
      { title, description: description || null, workflowId: workflow.id, fields: values },
      {
        onSuccess: () => {
          toast.success('Request created');
          onCreated();
        },
        onError: (error) => toast.error(getErrorMessage(error, 'Failed to create request')),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

      {workflow.fields.map((field) => {
        const error = showErrors ? errors[field.key] : undefined;
        const set = (v: string) => setRaw((r) => ({ ...r, [field.key]: v }));
        return field.type === 'select' ? (
          <Select
            key={field.key}
            label={field.label}
            required={field.required}
            error={error}
            value={raw[field.key] ?? ''}
            onChange={(e) => set(e.target.value)}
          >
            <option value="">Choose…</option>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            key={field.key}
            label={field.label}
            required={field.required}
            error={error}
            type={field.type === 'number' ? 'number' : 'text'}
            value={raw[field.key] ?? ''}
            onChange={(e) => set(e.target.value)}
          />
        );
      })}

      {conditional && (
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-navy-500 mb-2.5">Approval route for these values</h4>
          <WorkflowStepList
            compact
            steps={workflow.steps}
            fields={workflow.fields}
            stateFor={(i) => (skipped.includes(i) ? 'skipped' : 'pending')}
          />
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="submit" className="flex-1" loading={createRequest.isPending}>
          Create
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
