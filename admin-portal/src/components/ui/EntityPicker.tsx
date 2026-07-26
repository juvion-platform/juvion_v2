import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Check, Loader2, X } from 'lucide-react';

interface Props<T> {
  /** React Query key prefix; the search term is appended automatically. */
  queryKey: readonly unknown[];
  /** Fetcher receiving the debounced search term. Should return `{ items }`. */
  fetcher: (search: string) => Promise<{ items: T[] } | T[]>;
  value: string;
  onChange: (id: string) => void;
  /** Stable id for an option. */
  getId: (item: T) => string;
  /** Primary line shown for an option. */
  getLabel: (item: T) => string;
  /** Optional secondary line (roll number, department, email…). */
  getHint?: (item: T) => string | undefined;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Rendered when `value` is set but the record isn't in the loaded page. */
  fallbackLabel?: string;
  id?: string;
}

/**
 * Searchable single-select for referencing another entity.
 *
 * Replaces the raw "paste a MongoDB ObjectId here" text inputs the audit
 * flagged across HR, Compliance and Juvi. Loads options lazily on open and
 * filters server-side via the shared `?search=` param, so it stays usable on
 * collections far larger than a <select> could hold.
 */
export default function EntityPicker<T>({
  queryKey, fetcher, value, onChange, getId, getLabel, getHint,
  placeholder = 'Select…', disabled, required, fallbackLabel, id,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: [...queryKey, debounced],
    queryFn: () => fetcher(debounced),
    // Only hit the API once the field is actually opened.
    enabled: open,
    staleTime: 30_000,
  });

  const items: T[] = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : (data.items ?? []);
  }, [data]);

  const selected = items.find((i) => getId(i) === value);
  const selectedLabel = selected ? getLabel(selected) : (value ? (fallbackLabel ?? value) : '');

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 py-2 text-left text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-200 disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-700"
      >
        <span className={selectedLabel ? 'truncate text-gray-900' : 'truncate text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={15} className="text-gray-400" />
        </span>
      </button>

      {/* Keeps native form validation working for required pickers. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute bottom-1 left-3 h-0 w-0 opacity-0"
        />
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b p-2">
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Type to search…"
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {isFetching && items.length === 0 && (
              <li className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </li>
            )}
            {!isFetching && items.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">
                {term ? `No matches for “${term}”.` : 'No records available.'}
              </li>
            )}
            {items.map((item) => {
              const itemId = getId(item);
              const hint = getHint?.(item);
              return (
                <li key={itemId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={itemId === value}
                    onClick={() => { onChange(itemId); setOpen(false); setTerm(''); }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-primary-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-gray-900">{getLabel(item)}</span>
                      {hint && <span className="block truncate text-xs text-gray-500">{hint}</span>}
                    </span>
                    {itemId === value && <Check size={14} className="mt-0.5 shrink-0 text-primary-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
