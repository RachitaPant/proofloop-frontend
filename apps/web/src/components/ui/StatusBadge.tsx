import { Clock, Eye, CheckCircle2, XCircle, AlertTriangle, FileEdit, Ban, Flag } from 'lucide-react';
import Badge from './Badge';
import { RequestStatus } from '@/types';

/**
 * Single source of truth for status → color/icon mapping across the product.
 * Extend this map (not per-page switch statements) when new statuses appear.
 */
const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', tone: 'neutral' as const, icon: FileEdit },
  PENDING: { label: 'Pending', tone: 'warning' as const, icon: Clock },
  IN_REVIEW: { label: 'In Review', tone: 'brand' as const, icon: Eye },
  APPROVED: { label: 'Approved', tone: 'success' as const, icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', tone: 'danger' as const, icon: XCircle },
  ESCALATED: { label: 'Escalated', tone: 'danger' as const, icon: AlertTriangle },
  COMPLETED: { label: 'Completed', tone: 'success' as const, icon: Flag },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' as const, icon: Ban },
} satisfies Record<string, { label: string; tone: 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger'; icon: any }>;

export type SemanticStatus = keyof typeof STATUS_CONFIG;

interface StatusBadgeProps {
  status: RequestStatus | SemanticStatus;
  escalated?: boolean;
  className?: string;
}

export default function StatusBadge({ status, escalated, className }: StatusBadgeProps) {
  const key = (escalated ? 'ESCALATED' : status) as SemanticStatus;
  const config = STATUS_CONFIG[key] ?? STATUS_CONFIG.PENDING;
  const Icon = config.icon;

  return (
    <Badge tone={config.tone} className={className}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </Badge>
  );
}
