import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface Props { label: string; value: string | number; icon: LucideIcon; color?: string; trend?: string; }

export default function StatCard({ label, value, icon: Icon, color = 'bg-primary-50 text-primary-600', trend }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5 flex items-start gap-4">
      <div className={clsx('p-3 rounded-lg', color)}><Icon size={22} /></div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-navy">{value}</p>
        {trend && <p className="text-xs text-green-600 mt-1">{trend}</p>}
      </div>
    </div>
  );
}
