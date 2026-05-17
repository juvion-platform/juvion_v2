import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, ArrowRight, AlertTriangle, ShieldOff } from 'lucide-react';
import clsx from 'clsx';
import type { AxiosError } from 'axios';

import { runNlQuery, type NlQueryResponse } from '../../services/governance';

/**
 * 003-nl-report-queries §Story 2 — NL panel.
 *
 * Lives above the existing report picker on the ReportsPage. Admin types
 * a question, clicks Ask, and one of two banners renders:
 *
 *   - Matched → "Auto-selected: <reportCode>" with the rationale +
 *     "Run as picker" button that lifts the (reportCode, params) into the
 *     parent's existing picker form. Result rendering itself stays in the
 *     existing ReportRunner — we don't duplicate it here.
 *   - Refused → reason + chip list of supported reports + (for
 *     cap_reached) an amber banner.
 *
 * Parent (`ReportsPage`) decides visibility based on the user role.
 */

interface Props {
  /** Lifts the matched reportCode + params into the parent's picker state. */
  onRunAsPicker: (reportCode: string, params: Record<string, unknown>) => void;
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';

export default function NlQueryPanel({ onRunAsPicker }: Props) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<NlQueryResponse | null>(null);
  // 004 §10.12 / Story 6 — track 403 (policy denial) distinctly from
  // in-band refusals so we can render a specific banner.
  const [policyDenied, setPolicyDenied] = useState(false);

  const mut = useMutation({
    mutationFn: (q: string) => runNlQuery(q),
    onSuccess: (resp) => {
      setPolicyDenied(false);
      setResponse(resp);
    },
    onError: (err: AxiosError) => {
      setResponse(null);
      setPolicyDenied(err.response?.status === 403);
    },
  });

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    setPolicyDenied(false);
    mut.mutate(trimmed);
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-700">Ask a question</h3>
        <span className="text-xs text-gray-400">— AI maps your question to the right report</span>
      </div>
      <form onSubmit={handleAsk} className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question, e.g. how did the September funnel compare to August?"
          rows={2}
          maxLength={500}
          className={inp}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400">{question.length} / 500</span>
          <button
            type="submit"
            disabled={mut.isPending || question.trim().length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {mut.isPending ? 'Asking…' : 'Ask'}
          </button>
        </div>
      </form>

      {response && response.status === 'matched' && (
        <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
          <div className="text-xs font-semibold text-indigo-900 mb-1">
            Auto-selected: <span className="font-mono">{response.reportCode}</span>
            {response.isDuplicate && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-indigo-600">cached</span>
            )}
          </div>
          <p className="text-sm text-gray-700">{response.rationale}</p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => onRunAsPicker(response.reportCode, response.params)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              Run as picker <ArrowRight size={12} />
            </button>
            <span className="text-[11px] text-gray-500">Params will pre-fill the existing form.</span>
          </div>
        </div>
      )}

      {response && response.status === 'refused' && (
        <RefusedBanner response={response} />
      )}

      {policyDenied && <PolicyDeniedBanner />}
    </div>
  );
}

function PolicyDeniedBanner() {
  return (
    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
      <div className="flex items-start gap-2">
        <ShieldOff size={14} className="text-rose-600 mt-0.5 shrink-0" />
        <div className="text-xs text-rose-800">
          Your role can&apos;t run governance reports. If you believe this is incorrect, contact your administrator.
        </div>
      </div>
    </div>
  );
}

function refusalCopy(response: Extract<NlQueryResponse, { status: 'refused' }>): string {
  const { reason, reasonDimension } = response;
  // 004 §10.7 — render friendlier copy for the new sub-categorized reasons.
  if (reason === 'cap_reached') {
    return 'Daily AI question cap reached for this college. Try again tomorrow or contact your admin to raise the cap.';
  }
  if (reason === 'scope-unresolved') {
    return reasonDimension === 'department'
      ? 'We couldn\'t determine your department. Contact admin to update your Faculty record.'
      : 'We couldn\'t determine your profile. Contact admin to update your account.';
  }
  if (reason === 'report-not-scopable-for-role') {
    return reasonDimension === 'department'
      ? 'Your role can\'t view department-scoped data of this kind. Try a report from the list below.'
      : 'Your role can\'t view self-scoped data of this kind. Try a report from the list below.';
  }
  return reason; // timeout, parser reasons, report_run_failed
}

function RefusedBanner({ response }: { response: Extract<NlQueryResponse, { status: 'refused' }> }) {
  const isCap = response.reason === 'cap_reached' || response.capReached === true;
  const copy = refusalCopy(response);
  return (
    <div
      className={clsx(
        'mt-4 rounded-lg border p-3',
        isCap ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200',
      )}
    >
      <div className="flex items-start gap-2">
        {isCap && <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />}
        <div className="flex-1">
          <div className={clsx('text-xs', isCap ? 'text-amber-800' : 'text-gray-700')}>{copy}</div>
          {!isCap && response.supportedReports.length > 0 && (
            <>
              <div className="text-[11px] text-gray-500 mt-2 mb-1">Try one of these reports directly:</div>
              <div className="flex flex-wrap gap-1.5">
                {response.supportedReports.map((code) => (
                  <span key={code} className="font-mono text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700">
                    {code}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
