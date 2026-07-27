import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  trend?: string;
  to?: string;
  /** Renders a shimmer in place of the value while the stat query is in flight. */
  loading?: boolean;
}

export default function StatCard({ label, value, icon: Icon, color = 'bg-primary-50 text-primary-600', trend, to, loading }: Props) {
  const content = (
    <>
      <div className={clsx('p-3 rounded-lg', color)}><Icon size={22} /></div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        {loading
          ? <div className="mt-1.5 h-6 w-14 animate-pulse rounded bg-slate-200/70" aria-label={`${label} loading`} />
          : <p className="text-2xl font-bold text-navy">{value}</p>}
        {trend && !loading && <p className="text-xs text-green-600 mt-1">{trend}</p>}
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="bg-white rounded-xl shadow-sm border p-5 flex items-start gap-4 hover:shadow-md hover:border-teal-300 transition-all">
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-5 flex items-start gap-4">
      {content}
    </div>
  );
}
