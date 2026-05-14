import clsx from 'clsx';
import { Check, X, Sparkles } from 'lucide-react';

import type { ConfigSuggestion } from '../../services/platform-config';

/**
 * 002-ai-assisted-config §Story 2 — inline suggestion card.
 *
 * Rendered next to each schema field that has a pending suggestion.
 * Accept writes the suggestion into the form's in-memory state (the
 * parent tracks `aiAcceptedFields` for the save call). Reject dismisses
 * the suggestion locally. The card collapses to a quiet status pill
 * once it has been actioned.
 */

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

interface Props {
  suggestion: ConfigSuggestion;
  status: SuggestionStatus;
  onAccept: (field: string) => void;
  onReject: (field: string) => void;
  className?: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string') return `"${value}"`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function confidencePct(c: number): string {
  return `${Math.round(c * 100)}%`;
}

function confidenceTone(c: number): string {
  if (c >= 0.8) return 'bg-emerald-100 text-emerald-700';
  if (c >= 0.6) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

export default function SuggestionCard({ suggestion, status, onAccept, onReject, className }: Props) {
  const isPending = status === 'pending';

  return (
    <div
      className={clsx(
        'rounded-lg border p-3 text-xs mt-2',
        isPending ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-200 bg-gray-50/60',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Sparkles size={14} className="text-indigo-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-gray-800">Suggested:</span>
            <span className="font-mono text-gray-900">{formatValue(suggestion.suggestedValue)}</span>
            <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', confidenceTone(suggestion.confidence))}>
              {confidencePct(suggestion.confidence)}
            </span>
          </div>
          <p className="text-gray-600 leading-relaxed">{suggestion.rationale}</p>
          {isPending ? (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => onAccept(suggestion.field)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Check size={12} /> Accept
              </button>
              <button
                type="button"
                onClick={() => onReject(suggestion.field)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <X size={12} /> Reject
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <span
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium',
                  status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600',
                )}
              >
                {status === 'accepted' ? <Check size={10} /> : <X size={10} />}
                {status === 'accepted' ? 'Accepted' : 'Rejected'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
