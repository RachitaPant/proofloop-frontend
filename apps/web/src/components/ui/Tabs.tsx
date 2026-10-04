import { cn } from '@/lib/cn';

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 border-b border-surface-200" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px',
            active === tab.key
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-navy-500 hover:text-navy-800',
          )}
        >
          {tab.label}
          {typeof tab.count === 'number' && (
            <span
              className={cn(
                'ml-2 px-1.5 py-0.5 rounded-full text-xs',
                active === tab.key ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-navy-500',
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
