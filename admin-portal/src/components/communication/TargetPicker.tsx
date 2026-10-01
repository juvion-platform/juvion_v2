import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { PersonOption, TargetOption } from '../../services/notices';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';

/** A chosen target: the id goes on the wire, only the label is ever shown. */
export interface AudienceItem { id: string; label: string; hint?: string }

interface Props {
  /** Chip text and the listbox's accessible name, e.g. "Batches". */
  label: string;
  /** Fixed options from GET /targets, filtered here as the user types. */
  options?: TargetOption[];
  /** Server-side search (People): called with the debounced text. */
  search?: (q: string) => Promise<{ items: PersonOption[] }>;
  selected: AudienceItem[];
  onChange: (next: AudienceItem[]) => void;
  disabled?: boolean;
}

/**
 * One audience chip: a button that opens a searchable, multi-select listbox
 * (WAI-ARIA combobox pattern). Arrow keys move, Enter toggles, Escape closes
 * and returns focus to the chip without closing the drawer around it.
 */
export default function TargetPicker({ label, options, search, selected, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(term, 250);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-option-${i}`;

  const remote = useQuery({
    queryKey: ['notice-people', debounced],
    queryFn: () => search!(debounced),
    enabled: open && Boolean(search),
    meta: { silentError: true },
  });

  const shown: AudienceItem[] = useMemo(() => {
    if (search) return remote.data?.items ?? [];
    const needle = term.trim().toLowerCase();
    return (options ?? []).filter((o) => !needle || o.label.toLowerCase().includes(needle));
  }, [search, remote.data, options, term]);

  useEffect(() => { setActive(0); }, [term]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); setTerm(''); }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const isSelected = (id: string) => selected.some((s) => s.id === id);
  const toggle = (item: AudienceItem) =>
    onChange(isSelected(item.id) ? selected.filter((s) => s.id !== item.id) : [...selected, { id: item.id, label: item.label, ...(item.hint ? { hint: item.hint } : {}) }]);
  const close = () => { setOpen(false); setTerm(''); buttonRef.current?.focus(); };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(shown.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const item = shown[active]; if (item) toggle(item); }
    else if (e.key === 'Escape') {
      // Handled here: stop it reaching the drawer's document-level Escape (useDialogFocus).
      e.preventDefault(); e.stopPropagation(); close();
    }
  }

  const loading = Boolean(search) && remote.isFetching;
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50',
          selected.length ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        )}
      >
        {label}
        {selected.length > 0 && <span className="rounded-full bg-primary-600 px-1.5 text-xs text-white">{selected.length}</span>}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-80 rounded-lg border bg-white p-2 shadow-lg">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown[active] ? optionId(active) : undefined}
            aria-label={`Search ${label.toLowerCase()}`}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type to search…"
            className={inp}
          />
          <ul id={listId} role="listbox" aria-label={label} aria-multiselectable="true" className="mt-2 max-h-60 overflow-y-auto">
            {shown.map((o, i) => (
              <li
                key={o.id}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected(o.id)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(o)}
                className={clsx('flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm', i === active ? 'bg-primary-50' : 'hover:bg-gray-50')}
              >
                <Check size={14} aria-hidden="true" className={clsx('mt-0.5 shrink-0', isSelected(o.id) ? 'text-primary-600' : 'invisible')} />
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-gray-500">{o.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
          {loading && <p className="px-2 py-1 text-xs text-gray-500">Searching…</p>}
          {!loading && shown.length === 0 && <p className="px-2 py-1 text-xs text-gray-500">No matches you can send to.</p>}
        </div>
      )}
    </div>
  );
}
