import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Compass size={22} />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Page not found</h1>
        <p className="mt-1 text-sm text-slate-600">
          Nothing is mapped to <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{pathname}</code>.
          Check the address, or jump back to a known page.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={14} /> Go back
          </button>
          <Link
            to="/"
            className="inline-flex items-center rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
