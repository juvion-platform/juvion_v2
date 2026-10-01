import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import clsx from 'clsx';
import TargetPicker, { type AudienceItem } from './TargetPicker';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { previewAudience, searchNoticePeople, type AudienceRule, type AudienceRuleKind, type NoticeTargets, type TargetOption } from '../../services/notices';
import { KIND_LABELS, KIND_ORDER, errorStatus, noticeErrorMessage, roleLabel } from '../../lib/notices';

/** What the composer holds per kind. `all` present (with no items) means "Everyone". */
export type AudienceSelection = Partial<Record<AudienceRuleKind, AudienceItem[]>>;

const OPTION_KEYS: Partial<Record<AudienceRuleKind, 'departments' | 'programmes' | 'batches' | 'sections' | 'courseOfferings' | 'hostelBlocks'>> = {
  department: 'departments', programme: 'programmes', batch: 'batches', section: 'sections', course_offering: 'courseOfferings', hostel_block: 'hostelBlocks',
};

function optionsFor(kind: AudienceRuleKind, targets: NoticeTargets): TargetOption[] {
  if (kind === 'role') return targets.roles.map((id) => ({ id, label: roleLabel(id) }));
  const key = OPTION_KEYS[kind];
  return key ? targets[key] : [];
}

/** The rules the API takes, in a stable order so equal selections give equal keys. */
export function selectionToRules(sel: AudienceSelection): AudienceRule[] {
  return KIND_ORDER.flatMap((kind): AudienceRule[] => {
    const items = sel[kind];
    if (!items) return [];
    if (kind === 'all') return [{ kind, ids: [] }];
    return items.length ? [{ kind, ids: items.map((i) => i.id) }] : [];
  });
}

/**
 * The live audience count (spec §8, US-1.2): POST /audience-preview, debounced.
 * `current` is true only when the data matches the latest rules, which is what
 * the composer requires before it lets anyone publish.
 */
export function useAudiencePreview(rules: AudienceRule[], office: string | undefined, ms = 400) {
  const key = JSON.stringify({ rules, office: office ?? null });
  const settled = useDebouncedValue(key, ms);
  const parsed = useMemo(() => JSON.parse(settled) as { rules: AudienceRule[]; office: string | null }, [settled]);
  const query = useQuery({
    queryKey: ['notice-audience-preview', settled],
    queryFn: () => previewAudience(parsed.rules, parsed.office ?? undefined),
    enabled: parsed.rules.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
    meta: { silentError: true },
  });
  const current = key === settled && query.isSuccess && !query.isFetching && !query.isPlaceholderData;
  return { data: query.data, error: query.error, isError: query.isError, updating: key !== settled || query.isFetching, current };
}
export type AudiencePreviewState = ReturnType<typeof useAudiencePreview>;

interface Props {
  targets: NoticeTargets;
  value: AudienceSelection;
  onChange: (next: AudienceSelection) => void;
  preview: AudiencePreviewState;
  disabled?: boolean;
}

export default function AudienceBuilder({ targets, value, onChange, preview, disabled }: Props) {
  const kinds = KIND_ORDER.filter((k) => targets.kinds.includes(k));
  const hasRules = selectionToRules(value).length > 0;
  const setKind = (kind: AudienceRuleKind, items: AudienceItem[] | undefined) => {
    const next = { ...value };
    if (items === undefined || (kind !== 'all' && items.length === 0)) delete next[kind];
    else next[kind] = items;
    onChange(next);
  };

  return (
    <fieldset className="space-y-3">
      <legend className="block text-sm font-medium text-gray-700 mb-1">Audience</legend>
      {kinds.length === 0 ? (
        <p className="text-sm text-red-600">Your role cannot publish notices.</p>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose who receives this notice">
          {kinds.map((kind) => kind === 'all' ? (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              aria-pressed={value.all !== undefined}
              onClick={() => setKind('all', value.all !== undefined ? undefined : [])}
              className={clsx('rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50',
                value.all !== undefined ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50')}
            >
              {KIND_LABELS.all}
            </button>
          ) : (
            <TargetPicker
              key={kind}
              label={KIND_LABELS[kind]}
              options={kind === 'custom' ? undefined : optionsFor(kind, targets)}
              search={kind === 'custom' ? searchNoticePeople : undefined}
              selected={value[kind] ?? []}
              onChange={(items) => setKind(kind, items)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {hasRules && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected audience">
          {value.all !== undefined && (
            <li className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              Everyone at the college
              <button type="button" disabled={disabled} onClick={() => setKind('all', undefined)} aria-label="Remove Everyone" className="text-gray-500 hover:text-gray-900"><X size={12} /></button>
            </li>
          )}
          {KIND_ORDER.filter((k) => k !== 'all').flatMap((kind) => (value[kind] ?? []).map((item) => (
            <li key={`${kind}:${item.id}`} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              <span className="text-gray-500">{KIND_LABELS[kind]}:</span> {item.label}
              <button type="button" disabled={disabled} onClick={() => setKind(kind, (value[kind] ?? []).filter((i) => i.id !== item.id))}
                aria-label={`Remove ${item.label}`} className="text-gray-500 hover:text-gray-900"><X size={12} /></button>
            </li>
          )))}
        </ul>
      )}

      <AudienceCount hasRules={hasRules} preview={preview} />
    </fieldset>
  );
}

function AudienceCount({ hasRules, preview }: { hasRules: boolean; preview: AudiencePreviewState }) {
  if (!hasRules) return <p className="text-sm text-gray-500">Choose who should receive this notice.</p>;
  if (preview.isError) {
    // 403 is the server's scope refusal (spec §7.3); its message says what is out of scope.
    const prefix = errorStatus(preview.error) === 403 ? 'Outside your scope: ' : '';
    return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{prefix}{noticeErrorMessage(preview.error)}</p>;
  }
  const d = preview.data;
  return (
    <div className="rounded-lg border bg-gray-50 p-3 text-sm">
      {/* Only the totals sentence is announced, not the breakdown under it. */}
      <div aria-live="polite">
        {!d ? (
          <p className="text-gray-500">Counting the audience…</p>
        ) : (
          <p className="text-gray-900">
            <span className="font-semibold">{d.total.toLocaleString('en-IN')}</span> {d.total === 1 ? 'person' : 'people'}
            {' · '}{d.onJuvi.toLocaleString('en-IN')} on Juvi
            {' · '}{d.notOnJuvi.toLocaleString('en-IN')} not on Juvi yet
            {preview.updating && <span className="ml-2 text-xs text-gray-500">updating…</span>}
          </p>
        )}
      </div>
      {d && (
        <>
          <p className="mt-0.5 text-gray-500">{d.line}</p>
          {d.notOnJuvi > 0 && <p className="mt-1 text-xs text-gray-500">People not on Juvi yet get the notice when they activate the app.</p>}
          {d.groups.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto">
              <table className="w-full text-xs" aria-label="Audience by batch, section or department">
                <thead className="text-left text-gray-500">
                  <tr><th className="py-1 font-medium">Group</th><th className="py-1 text-right font-medium">People</th><th className="py-1 text-right font-medium">On Juvi</th></tr>
                </thead>
                <tbody>
                  {d.groups.map((g) => (
                    <tr key={g.label} className="border-t">
                      <td className="py-1">{g.label}</td>
                      <td className="py-1 text-right tabular-nums">{g.total}</td>
                      <td className="py-1 text-right tabular-nums">{g.onJuvi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
