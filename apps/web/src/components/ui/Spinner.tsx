import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export default function Spinner({ className, full }: { className?: string; full?: boolean }) {
  const spinner = <Loader2 className={cn('w-6 h-6 animate-spin text-brand-600', className)} />;
  if (!full) return spinner;
  return (
    <div className="flex justify-center py-12" role="status" aria-label="Loading">
      {spinner}
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return <div className={cn('skeleton h-16 w-full', className)} />;
}
