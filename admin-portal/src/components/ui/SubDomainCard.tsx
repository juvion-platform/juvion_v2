import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface Props { to: string; icon: LucideIcon; label: string; count?: number; description?: string; }

export default function SubDomainCard({ to, icon: Icon, label, count, description }: Props) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} className="bg-white rounded-xl border shadow-sm p-5 text-left hover:shadow-md transition-shadow w-full">
      <div className="flex items-center gap-3 mb-2">
        <Icon size={20} className="text-primary-500" />
        <span className="font-medium">{label}</span>
        {count !== undefined && <span className="ml-auto text-sm text-gray-400">{count}</span>}
      </div>
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </button>
  );
}
