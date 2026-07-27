import { X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Message shown when `options` is empty (e.g. the catalog is still loading). */
  emptyMessage?: string;
  columns?: 1 | 2 | 3;
}

/**
 * Checkbox multi-select over a known set of values.
 *
 * Replaces the comma-separated free-text inputs the audit flagged, where a
 * typo silently created an invalid module or persona name that nothing would
 * ever match.
 */
export default function MultiSelect({
  options, value, onChange, disabled, emptyMessage = 'No options available.', columns = 2,
}: Props) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  // Values present on the record but no longer in the catalog — surfaced so a
  // legacy typo is visible and removable rather than invisibly retained.
  const unknown = value.filter((v) => !options.some((o) => o.value === v));

  const gridCls = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-300 p-2">
        {options.length === 0 ? (
          <p className="p-1 text-sm text-gray-400">{emptyMessage}</p>
        ) : (
          <div className={`grid ${gridCls} gap-x-3 gap-y-1`}>
            {options.map((o) => (
              <label
                key={o.value}
                className={`flex items-start gap-2 rounded px-1.5 py-1 text-sm ${disabled ? 'cursor-default opacity-70' : 'cursor-pointer hover:bg-primary-50'}`}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={value.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-gray-500">{o.hint}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {unknown.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-amber-700">Unrecognised:</span>
          {unknown.map((u) => (
            <span key={u} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
              {u}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== u))}
                  aria-label={`Remove ${u}`}
                  className="text-amber-600 hover:text-amber-900"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <p className="mt-1 text-xs text-gray-500">{value.length} selected</p>
    </div>
  );
}
