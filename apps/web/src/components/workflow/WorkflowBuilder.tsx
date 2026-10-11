'use client';

import { useState } from 'react';
import { GitFork, Plus, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ConditionOperator, CreateWorkflowPayload, FieldType } from '@proofloop/shared';
import { Role } from '@/types';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/errors';
import { useCreateWorkflow, useGroups } from '@/lib/queries';

// Form state is kept as strings (what inputs hold) and converted to the API
// shape on submit. The server validates again with the shared Zod schema.

interface FieldDraft {
  label: string;
  type: FieldType;
  required: boolean;
  optionsText: string;
}

interface RuleDraft {
  field: string;
  operator: ConditionOperator;
  value: string;
}

interface StepDraft {
  stepName: string;
  /** "role:REVIEWER" or "group:<id>" */
  assignee: string;
  requiredApprovals: string;
  slaHours: string;
  parallelWithPrevious: boolean;
  conditional: boolean;
  mode: 'all' | 'any';
  rules: RuleDraft[];
}

const OPERATORS: Record<FieldType, { value: ConditionOperator; label: string }[]> = {
  number: [
    { value: 'gt', label: '>' },
    { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '≤' },
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
  ],
  select: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'in', label: 'is one of' },
  ],
  text: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'contains', label: 'contains' },
  ],
};

const emptyStep = (): StepDraft => ({
  stepName: '',
  assignee: `role:${Role.REVIEWER}`,
  requiredApprovals: '1',
  slaHours: '',
  parallelWithPrevious: false,
  conditional: false,
  mode: 'all',
  rules: [],
});

/** "Cost centre (EUR)" → "costCentreEur"; unique within the workflow. */
function keyFromLabel(label: string, taken: Set<string>): string {
  const words = label.toLowerCase().match(/[a-z0-9]+/g) ?? ['field'];
  let key = words.map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1))).join('');
  if (!/^[a-z]/.test(key)) key = `f${key}`;
  key = key.slice(0, 40);
  let unique = key;
  for (let n = 2; taken.has(unique); n++) unique = `${key}${n}`;
  taken.add(unique);
  return unique;
}

const EXAMPLE: { name: string; description: string; fields: FieldDraft[]; steps: StepDraft[] } = {
  name: 'Purchase approval',
  description: 'Manager sign-off, then legal and security in parallel; the CFO only for large amounts.',
  fields: [
    { label: 'Amount', type: 'number', required: true, optionsText: '' },
    { label: 'Department', type: 'select', required: true, optionsText: 'Engineering, Finance, Sales' },
  ],
  steps: [
    { ...emptyStep(), stepName: 'Manager review', slaHours: '24' },
    { ...emptyStep(), stepName: 'Legal review' },
    { ...emptyStep(), stepName: 'Security review', parallelWithPrevious: true },
    {
      ...emptyStep(),
      stepName: 'CFO approval',
      assignee: `role:${Role.ADMIN}`,
      conditional: true,
      rules: [{ field: 'amount', operator: 'gt', value: '100000' }],
    },
  ],
};

export default function WorkflowBuilder({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);
  const createWorkflow = useCreateWorkflow();
  const { data: groups = [] } = useGroups();

  // Keys are derived from labels so conditions can reference them.
  const keysFor = (drafts: FieldDraft[]) => {
    const taken = new Set<string>();
    return drafts.map((f) => keyFromLabel(f.label, taken));
  };
  const fieldKeys = keysFor(fields);
  const fieldOptions = fields.map((f, i) => ({ key: fieldKeys[i]!, label: f.label || `Field ${i + 1}`, type: f.type }));

  const updateField = (i: number, patch: Partial<FieldDraft>) => {
    const next = fields.map((f, k) => (k === i ? { ...f, ...patch } : f));
    // Renaming a field changes its key; keep rules pointing at the same field.
    const before = keysFor(fields);
    const after = keysFor(next);
    const renamed = new Map(before.map((key, k) => [key, after[k]!]));
    setFields(next);
    setSteps((all) => all.map((s) => ({ ...s, rules: s.rules.map((r) => ({ ...r, field: renamed.get(r.field) ?? r.field })) })));
  };
  const updateStep = (i: number, patch: Partial<StepDraft>) =>
    setSteps((all) => all.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const updateRule = (i: number, r: number, patch: Partial<RuleDraft>) =>
    setSteps((all) =>
      all.map((s, k) => (k === i ? { ...s, rules: s.rules.map((rule, j) => (j === r ? { ...rule, ...patch } : rule)) } : s)),
    );

  const loadExample = () => {
    setName(EXAMPLE.name);
    setDescription(EXAMPLE.description);
    setFields(EXAMPLE.fields);
    setSteps(EXAMPLE.steps);
  };

  const toPayload = (): CreateWorkflowPayload => {
    let stage = -1;
    return {
      name,
      description: description || null,
      fields: fields.map((f, i) => ({
        key: fieldKeys[i]!,
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.type === 'select' ? f.optionsText.split(',').map((o) => o.trim()).filter(Boolean) : null,
      })),
      steps: steps.map((s, i) => {
        if (!(s.parallelWithPrevious && i > 0)) stage++;
        const fieldType = (key: string) => fieldOptions.find((f) => f.key === key)?.type;
        return {
          stepIndex: i,
          stepName: s.stepName,
          requiredRole: s.assignee.startsWith('role:') ? (s.assignee.slice(5) as Role) : null,
          approverGroupId: s.assignee.startsWith('group:') ? s.assignee.slice(6) : null,
          requiredApprovals: parseInt(s.requiredApprovals) || 1,
          slaHours: s.slaHours ? parseInt(s.slaHours) : null,
          stage,
          condition:
            s.conditional && s.rules.length > 0
              ? {
                  mode: s.mode,
                  rules: s.rules.map((r) => ({
                    field: r.field,
                    operator: r.operator,
                    value:
                      r.operator === 'in'
                        ? r.value.split(',').map((v) => v.trim()).filter(Boolean)
                        : fieldType(r.field) === 'number'
                          ? Number(r.value)
                          : r.value,
                  })),
                }
              : null,
        };
      }),
    };
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createWorkflow.mutate(toPayload(), {
      onSuccess: () => {
        toast.success('Workflow created');
        onCreated();
      },
      onError: (error) => toast.error(getErrorMessage(error, 'Failed to create workflow')),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex justify-end -mt-2">
        <Button type="button" variant="ghost" size="sm" onClick={loadExample}>
          <Sparkles className="w-3.5 h-3.5" />
          Load example
        </Button>
      </div>

      <div className="space-y-4">
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {/* Request fields */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-navy-800 text-sm">Request fields</h3>
            <p className="text-xs text-navy-500">What requesters fill in. Steps can route on these values.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFields((all) => [...all, { label: '', type: 'number', required: false, optionsText: '' }])}
          >
            <Plus className="w-3.5 h-3.5" />
            Add field
          </Button>
        </div>
        {fields.map((field, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end border border-surface-200 rounded-lg p-3 bg-surface-50">
            <div className="col-span-5">
              <Input
                label="Label"
                required
                value={field.label}
                hint={field.label ? `key: ${fieldKeys[i]}` : undefined}
                onChange={(e) => updateField(i, { label: e.target.value })}
              />
            </div>
            <div className="col-span-3">
              <Select label="Type" value={field.type} onChange={(e) => updateField(i, { type: e.target.value as FieldType })}>
                <option value="number">Number</option>
                <option value="text">Text</option>
                <option value="select">Choice</option>
              </Select>
            </div>
            <label className="col-span-3 flex items-center gap-2 text-sm text-navy-700 pb-2.5">
              <input type="checkbox" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
              Required
            </label>
            <button
              type="button"
              aria-label="Remove field"
              className="col-span-1 pb-2.5 text-navy-400 hover:text-danger-600"
              onClick={() => setFields((all) => all.filter((_, k) => k !== i))}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {field.type === 'select' && (
              <div className="col-span-12">
                <Input
                  label="Choices (comma-separated)"
                  required
                  value={field.optionsText}
                  placeholder="Engineering, Finance, Sales"
                  onChange={(e) => updateField(i, { optionsText: e.target.value })}
                />
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Steps */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-navy-800 text-sm">Approval steps</h3>
            <p className="text-xs text-navy-500">Run top to bottom. Mark a step parallel to run it alongside the one above.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setSteps((all) => [...all, emptyStep()])}>
            <Plus className="w-3.5 h-3.5" />
            Add step
          </Button>
        </div>

        {steps.map((s, i) => (
          <div key={i} className="border border-surface-200 p-4 rounded-lg space-y-3 bg-surface-50">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-xs text-navy-500 uppercase tracking-wide">Step {i + 1}</h4>
              {steps.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove step"
                  className="text-navy-400 hover:text-danger-600"
                  onClick={() => setSteps((all) => all.filter((_, k) => k !== i))}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Step name" required value={s.stepName} onChange={(e) => updateStep(i, { stepName: e.target.value })} />
              <Select label="Assigned to" value={s.assignee} onChange={(e) => updateStep(i, { assignee: e.target.value })}>
                <optgroup label="Anyone with role">
                  <option value={`role:${Role.REVIEWER}`}>Reviewer</option>
                  <option value={`role:${Role.ADMIN}`}>Admin</option>
                  <option value={`role:${Role.USER}`}>User</option>
                </optgroup>
                {groups.length > 0 && (
                  <optgroup label="Approver group">
                    {groups.map((g) => (
                      <option key={g.id} value={`group:${g.id}`}>
                        {g.name} ({g.members.length})
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
              <Input
                label="Required approvals"
                type="number"
                min="1"
                value={s.requiredApprovals}
                onChange={(e) => updateStep(i, { requiredApprovals: e.target.value })}
              />
              <Input
                label="SLA hours (optional)"
                type="number"
                min="1"
                placeholder="e.g. 24"
                value={s.slaHours}
                onChange={(e) => updateStep(i, { slaHours: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-700">
              {i > 0 && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.parallelWithPrevious}
                    onChange={(e) => updateStep(i, { parallelWithPrevious: e.target.checked })}
                  />
                  <GitFork className="w-3.5 h-3.5 text-accent-600" />
                  Run in parallel with step {i}
                </label>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.conditional}
                  disabled={fields.length === 0}
                  onChange={(e) =>
                    updateStep(i, {
                      conditional: e.target.checked,
                      rules:
                        e.target.checked && s.rules.length === 0 && fieldOptions[0]
                          ? [{ field: fieldOptions[0].key, operator: OPERATORS[fieldOptions[0].type][0]!.value, value: '' }]
                          : s.rules,
                    })
                  }
                />
                Only when… {fields.length === 0 && <span className="text-xs text-navy-400">(add a request field first)</span>}
              </label>
            </div>

            {s.conditional && (
              <div className="space-y-2 rounded-md border border-surface-200 bg-white p-3">
                {s.rules.length > 1 && (
                  <Select
                    aria-label="Match mode"
                    value={s.mode}
                    onChange={(e) => updateStep(i, { mode: e.target.value as 'all' | 'any' })}
                  >
                    <option value="all">All of these are true</option>
                    <option value="any">Any of these is true</option>
                  </Select>
                )}
                {s.rules.map((rule, r) => {
                  const type = fieldOptions.find((f) => f.key === rule.field)?.type ?? 'text';
                  return (
                    <div key={r} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <Select
                          aria-label="Field"
                          value={rule.field}
                          onChange={(e) => {
                            const nextType = fieldOptions.find((f) => f.key === e.target.value)?.type ?? 'text';
                            updateRule(i, r, { field: e.target.value, operator: OPERATORS[nextType][0]!.value });
                          }}
                        >
                          {fieldOptions.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Select
                          aria-label="Operator"
                          value={rule.operator}
                          onChange={(e) => updateRule(i, r, { operator: e.target.value as ConditionOperator })}
                        >
                          {OPERATORS[type].map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="col-span-4">
                        <Input
                          aria-label="Value"
                          required
                          type={type === 'number' && rule.operator !== 'in' ? 'number' : 'text'}
                          placeholder={rule.operator === 'in' ? 'A, B, C' : 'value'}
                          value={rule.value}
                          onChange={(e) => updateRule(i, r, { value: e.target.value })}
                        />
                      </div>
                      <button
                        type="button"
                        aria-label="Remove rule"
                        className="col-span-1 text-navy-400 hover:text-danger-600"
                        onClick={() =>
                          updateStep(i, { rules: s.rules.filter((_, j) => j !== r), conditional: s.rules.length > 1 })
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                {fieldOptions[0] && s.rules.length < 10 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateStep(i, {
                        rules: [
                          ...s.rules,
                          { field: fieldOptions[0]!.key, operator: OPERATORS[fieldOptions[0]!.type][0]!.value, value: '' },
                        ],
                      })
                    }
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add rule
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="flex gap-3 pt-1">
        <Button type="submit" className="flex-1" loading={createWorkflow.isPending}>
          Create workflow
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
