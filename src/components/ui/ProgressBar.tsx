import { cn } from '@/lib/cn';

type Tone = 'brand' | 'success' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  brand: 'bg-brand-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
};

export default function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  className,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn('w-full h-1.5 bg-surface-200 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-300', toneClasses[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
