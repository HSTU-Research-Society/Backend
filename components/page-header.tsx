import { Plus } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function PageHeader({ title, description, actionLabel, onAction }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6 shrink-0">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <div className="flex-none">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
