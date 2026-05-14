import clsx from 'clsx';

import type { LeadGrade } from '../../services/admissions';

/**
 * 001-ai-lead-scoring §Story 4.
 *
 * Single visual primitive for "what grade and how strong is this lead."
 * Used in the InquiriesPage row, the inquiry detail modal header, and
 * anywhere else we need to communicate scoring at a glance.
 */

const GRADE_STYLES: Record<LeadGrade, { dot: string; pill: string; label: string }> = {
  hot:     { dot: 'bg-red-500',    pill: 'bg-red-50 text-red-700 border-red-200',       label: 'hot' },
  warm:    { dot: 'bg-orange-500', pill: 'bg-orange-50 text-orange-700 border-orange-200', label: 'warm' },
  cold:    { dot: 'bg-gray-400',   pill: 'bg-gray-50 text-gray-700 border-gray-200',     label: 'cold' },
  dormant: { dot: 'bg-slate-300',  pill: 'bg-slate-50 text-slate-600 border-slate-200',  label: 'dormant' },
};

interface Props {
  grade?: LeadGrade | string;
  score?: number | null;
  className?: string;
}

export default function LeadGradeBadge({ grade, score, className }: Props) {
  if (!grade || !(grade in GRADE_STYLES)) {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium',
          'bg-gray-50 text-gray-400 border-gray-200',
          className,
        )}
        title="This lead has not been scored yet"
      >
        unscored
      </span>
    );
  }
  const s = GRADE_STYLES[grade as LeadGrade];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium',
        s.pill,
        className,
      )}
      title={`Lead grade: ${s.label}${typeof score === 'number' ? ` · score ${score}/100` : ''}`}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', s.dot)} />
      <span>{s.label}</span>
      <span className="font-semibold tabular-nums">
        {typeof score === 'number' ? score : '—'}
      </span>
    </span>
  );
}
