import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Debounce before firing onChange, so typing doesn't refetch per keystroke. */
  debounceMs?: number;
  className?: string;
  'aria-label'?: string;
}

export default function SearchInput({
  value, onChange, placeholder = 'Search…', debounceMs = 300, className = '', ...rest
}: Props) {
  const [local, setLocal] = useState(value);

  // Keep in sync when the parent resets the query (e.g. "clear filters").
  useEffect(() => { setLocal(value); }, [value]);

  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, debounceMs]);

  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label={rest['aria-label'] ?? placeholder}
        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
      />
      {local && (
        <button
          type="button"
          onClick={() => { setLocal(''); onChange(''); }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
