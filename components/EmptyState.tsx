import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  className = '',
}) => (
  <div
    className={`flex flex-col items-center justify-center py-10 px-4 text-center text-slate-400 ${className}`}
  >
    <div className="bg-slate-100 p-6 rounded-full mb-4">
      <Icon size={40} className="text-slate-400" strokeWidth={1.5} />
    </div>
    <p className="font-bold text-slate-500 text-sm">{title}</p>
    {description && <p className="text-xs text-slate-400 mt-1 max-w-[240px]">{description}</p>}
  </div>
);
