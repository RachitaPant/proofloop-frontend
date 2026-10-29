import { CheckCircle2, Users, Clock, GitFork, Filter, AlertTriangle, MinusCircle } from 'lucide-react';
import { describeCondition, stageCount, stepsInStage } from '@proofloop/shared';
import type { WorkflowField, WorkflowStep } from '@/types';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { cn } from '@/lib/cn';

export type StepState = 'complete' | 'current' | 'pending' | 'skipped';

interface WorkflowStepListProps {
  steps: WorkflowStep[];
  /** Used to show conditions with field labels. */
  fields?: WorkflowField[];
  stateFor?: (index: number) => StepState;
  approvalsFor?: (index: number) => number;
  isEscalated?: (index: number) => boolean;
  compact?: boolean;
}

/**
 * Renders a workflow's route, stage by stage. Steps in the same stage run in
 * parallel and are shown side by side under one stage marker. Used by the
 * workflow list (no state) and the request detail tracker (with state).
 */
export default function WorkflowStepList({
  steps,
  fields = [],
  stateFor,
  approvalsFor,
  isEscalated,
  compact,
}: WorkflowStepListProps) {
  const stages = Array.from({ length: stageCount(steps) }, (_, stage) => stepsInStage(steps, stage));

  return (
    <div className="space-y-3">
      {stages.map((indices, stage) => {
        const states = indices.map((i) => stateFor?.(i) ?? 'pending');
        const stageComplete = states.every((s) => s === 'complete' || s === 'skipped') && states.some((s) => s === 'complete');
        const stageCurrent = states.some((s) => s === 'current');
        const stageSkipped = states.every((s) => s === 'skipped');
        const isLast = stage === stages.length - 1;
        const parallel = indices.length > 1;

        return (
          <div key={stage} className="relative flex gap-3">
            {!isLast && !compact && (
              <div
                className={cn(
                  'absolute left-4 top-9 w-px h-[calc(100%-4px)]',
                  stageComplete ? 'bg-success-300' : 'bg-surface-200',
                )}
              />
            )}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors',
                stageComplete ? 'bg-success-500' : stageCurrent ? 'bg-brand-600' : 'bg-surface-200',
              )}
            >
              {stageComplete ? (
                <CheckCircle2 className="w-4.5 h-4.5 text-white" />
              ) : stageSkipped ? (
                <MinusCircle className="w-4 h-4 text-navy-400" />
              ) : (
                <span className={cn('text-sm font-semibold', stageCurrent ? 'text-white' : 'text-navy-500')}>
                  {stage + 1}
                </span>
              )}
            </div>

            <div className={cn('flex-1 min-w-0 space-y-2', !compact && 'mb-1')}>
              {parallel && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-accent-700">
                  <GitFork className="w-3.5 h-3.5" />
                  {indices.length} steps in parallel: all must approve
                </div>
              )}
              <div className={cn(parallel && 'grid gap-2 sm:grid-cols-2')}>
                {indices.map((i, k) => (
                  <StepCard
                    key={i}
                    step={steps[i]!}
                    fields={fields}
                    state={states[k]!}
                    approved={approvalsFor?.(i)}
                    escalated={isEscalated?.(i) ?? false}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepCard({
  step,
  fields,
  state,
  approved,
  escalated,
}: {
  step: WorkflowStep;
  fields: WorkflowField[];
  state: StepState;
  approved?: number;
  escalated: boolean;
}) {
  const skipped = state === 'skipped';

  return (
    <div
      className={cn(
        'rounded-lg px-4 py-3 border',
        state === 'current' ? 'bg-brand-50 border-brand-200' : 'bg-white border-surface-200',
        skipped && 'bg-surface-50 border-dashed opacity-70',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('font-medium text-navy-900', skipped && 'line-through text-navy-400')}>{step.stepName}</span>
        <Badge tone={escalated ? 'danger' : step.approverGroupId ? 'accent' : 'neutral'}>
          {escalated ? <AlertTriangle className="w-3 h-3" /> : step.approverGroupId && <Users className="w-3 h-3" />}
          {escalated ? 'ADMIN (escalated)' : (step.approverGroupName ?? step.requiredRole)}
        </Badge>
        {state === 'complete' && <Badge tone="success">Approved</Badge>}
        {skipped && <Badge tone="neutral">Skipped</Badge>}
        {step.requiredApprovals > 1 && (
          <Badge tone="accent">
            <Users className="w-3 h-3" />
            {step.requiredApprovals} needed
          </Badge>
        )}
        {step.slaHours && (
          <Badge tone="warning">
            <Clock className="w-3 h-3" />
            SLA {step.slaHours}h
          </Badge>
        )}
      </div>

      {step.condition && (
        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-navy-500">
          <Filter className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Only when {describeCondition(step.condition, fields)}
            {skipped && ': not met by this request'}
          </span>
        </div>
      )}

      {approved !== undefined && step.requiredApprovals > 1 && !skipped && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-1">
            <span>Approval progress</span>
            <span className="font-medium text-navy-700">
              {approved} / {step.requiredApprovals}
            </span>
          </div>
          <ProgressBar value={approved} max={step.requiredApprovals} tone="brand" />
        </div>
      )}
    </div>
  );
}
