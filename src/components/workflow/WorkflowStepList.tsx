import { CheckCircle2, Users, Clock } from 'lucide-react';
import { WorkflowStep } from '@/types';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { cn } from '@/lib/cn';

interface WorkflowStepListProps {
  steps: WorkflowStep[];
  currentStep?: number;
  isComplete?: (index: number) => boolean;
  isCurrent?: (index: number) => boolean;
  approvalsFor?: (index: number) => number;
  compact?: boolean;
}

/**
 * Single reusable rendering of workflow step progression, used by both the
 * workflow builder list view and the request detail progress tracker.
 */
export default function WorkflowStepList({
  steps,
  isComplete,
  isCurrent,
  approvalsFor,
  compact,
}: WorkflowStepListProps) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const complete = isComplete?.(i) ?? false;
        const current = isCurrent?.(i) ?? false;
        const approved = approvalsFor?.(i) ?? 0;
        const isLast = i === steps.length - 1;

        return (
          <div key={i} className="relative flex gap-3">
            {!isLast && !compact && (
              <div
                className={cn(
                  'absolute left-4 top-9 w-px h-[calc(100%-4px)]',
                  complete ? 'bg-success-300' : 'bg-surface-200',
                )}
              />
            )}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-colors',
                complete ? 'bg-success-500' : current ? 'bg-brand-600' : 'bg-surface-200',
              )}
            >
              {complete ? (
                <CheckCircle2 className="w-4.5 h-4.5 text-white" />
              ) : (
                <span className={cn('text-sm font-semibold', current ? 'text-white' : 'text-navy-500')}>
                  {i + 1}
                </span>
              )}
            </div>

            <div
              className={cn(
                'flex-1 rounded-lg px-4 py-3 border',
                current ? 'bg-brand-50 border-brand-200' : 'bg-white border-surface-200',
                !compact && 'mb-1',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-navy-900">{step.stepName}</span>
                <Badge tone="neutral">{step.requiredRole}</Badge>
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

              {approvalsFor && step.requiredApprovals > 1 && (
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
          </div>
        );
      })}
    </div>
  );
}
