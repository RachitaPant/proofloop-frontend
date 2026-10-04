import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-white rounded-lg border border-dashed border-surface-300">
      <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-navy-400" />
      </div>
      <h3 className="font-medium text-navy-800">{title}</h3>
      {description && <p className="text-sm text-navy-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
