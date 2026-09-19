import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { RequestAction } from '@/types';
import { cn } from '@/lib/cn';

/**
 * Tamper-evident audit trail: each entry shows actor, action, timestamp,
 * comment, and the hash-chain link that proves integrity with the prior entry.
 */
export default function AuditTrail({ history }: { history: RequestAction[] }) {
  if (history.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-4 h-4 text-brand-600" />
        <span className="text-xs font-medium text-navy-500">
          Tamper-evident — each entry is cryptographically chained to the previous one
        </span>
      </div>

      <ol className="space-y-0">
        {history.map((action, i) => {
          const approved = action.action === 'APPROVED';
          const isLast = i === history.length - 1;
          return (
            <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast && <div className="absolute left-[15px] top-8 w-px h-[calc(100%-20px)] bg-surface-200" />}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                  approved ? 'bg-success-100' : 'bg-danger-100',
                )}
              >
                {approved ? (
                  <CheckCircle2 className="w-4 h-4 text-success-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-danger-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-navy-900">{action.actedByName}</span>
                  <span className={cn('text-sm', approved ? 'text-success-700' : 'text-danger-700')}>
                    {approved ? 'approved' : 'rejected'} step {action.stepIndex + 1}
                  </span>
                  <span className="text-xs text-navy-400">
                    {new Date(action.timestamp).toLocaleString()}
                  </span>
                </div>
                {action.comment && (
                  <p className="text-sm text-navy-600 mt-1 italic">&ldquo;{action.comment}&rdquo;</p>
                )}
                <div className="text-xs font-mono text-navy-300 mt-1 truncate">
                  hash {action.currentHash.slice(0, 20)}…
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
