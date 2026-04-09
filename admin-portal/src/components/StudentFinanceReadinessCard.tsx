import Badge from './ui/Badge';
import { Link } from 'react-router-dom';

type StudentRecord = any;

interface Props {
  student?: StudentRecord | null;
  loading?: boolean;
  title?: string;
  enforceFeeGuardian?: boolean;
}

export default function StudentFinanceReadinessCard({ student, loading = false, title = 'Student Finance Readiness', enforceFeeGuardian = true }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-sky-700">{title}</div>
        <div className="mt-2 text-sm text-sky-900">Checking guardian linkage and onboarding status...</div>
      </div>
    );
  }

  if (!student) return null;

  const blockers = [
    !student.feeResponsibleParentId ? 'Fee responsible guardian not linked' : null,
    ...(student.onboardingCompleteness?.missing || []),
  ].filter(Boolean);
  const financeReady = Boolean(student.feeResponsibleParentId);
  const studentName = student.personId?.name || student.person?.name || student.rollNumber || student._id;
  const statusVariant = financeReady ? 'success' : enforceFeeGuardian ? 'danger' : 'warning';
  const statusLabel = financeReady ? 'Finance ready' : enforceFeeGuardian ? 'Finance blocked' : 'Needs attention';

  return (
    <div className={`rounded-xl border p-4 ${financeReady ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className={`text-xs uppercase tracking-[0.2em] ${financeReady ? 'text-emerald-700' : 'text-amber-700'}`}>{title}</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{studentName}</div>
          <div className="mt-1 text-sm text-slate-600">
            Roll: {student.rollNumber || 'Not assigned'} - Onboarding status: {(student.onboardingStatus || 'not_started').replace(/_/g, ' ')}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant}>
            {statusLabel}
          </Badge>
          <Badge variant={student.profileCompleteness?.status === 'complete' ? 'success' : student.profileCompleteness?.status === 'progressing' ? 'warning' : 'default'}>
            {student.profileCompleteness?.percent || 0}% profile
          </Badge>
          <Badge variant={student.onboardingCompleteness?.status === 'completed' ? 'success' : student.onboardingCompleteness?.status === 'in_progress' ? 'warning' : 'default'}>
            {student.onboardingCompleteness?.percent || 0}% onboarded
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-white/60 bg-white/70 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Guardian linkage</div>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <div>Primary guardian: {student.primaryParentId?.personId?.name || 'Missing'}</div>
            <div>Fee guardian: {student.feeResponsibleParentId?.personId?.name || 'Missing'}</div>
          </div>
        </div>
        <div className="rounded-lg border border-white/60 bg-white/70 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Current blockers</div>
          {blockers.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {blockers.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-emerald-700">No blockers. This student is ready for finance actions.</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/people/students/${student._id}/edit`} target="_blank" className="inline-flex items-center rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white">
          Open student profile
        </Link>
        <Link to="/people/students?needsAttention=true" target="_blank" className="inline-flex items-center rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white">
          Open onboarding queue
        </Link>
      </div>

      {!financeReady && enforceFeeGuardian && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-sm text-amber-900">
          Finance records cannot be created until a fee-responsible guardian is linked on the student profile.
        </div>
      )}

      {!financeReady && !enforceFeeGuardian && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-sm text-amber-900">
          Fee guardian is still missing. Downstream fee operations may fail or require follow-up until the student profile is completed.
        </div>
      )}
    </div>
  );
}
