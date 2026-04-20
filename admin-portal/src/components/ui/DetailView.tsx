import clsx from 'clsx';

/**
 * Shared primitives for read-only detail pages.
 *
 *   <DetailSection title="Personal Information">
 *     <DetailField label="Name" value={student.person.name} />
 *     <DetailField label="Phone" value={student.person.phone} />
 *     <DetailField label="Status"><Badge>...</Badge></DetailField>
 *   </DetailSection>
 *
 * Values default to "—" when empty/null so every field renders consistently
 * regardless of backend data completeness.
 */

export function DetailSection({
  title, children, columns = 3,
}: {
  title: string;
  children: React.ReactNode;
  /** Grid columns on md+ breakpoints. Default 3; use 2 for narrow sections. */
  columns?: 2 | 3 | 4;
}) {
  const gridCls = columns === 2
    ? 'md:grid-cols-2'
    : columns === 4
      ? 'md:grid-cols-4'
      : 'md:grid-cols-3';

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">{title}</h3>
      </header>
      <div className={clsx('grid grid-cols-1 gap-x-6 gap-y-4 p-5', gridCls)}>
        {children}
      </div>
    </section>
  );
}

export interface DetailFieldProps {
  label: string;
  /** String/number value. Null/undefined/empty renders as "—". */
  value?: string | number | null;
  /** Full-width field spans all columns (use for long text like address). */
  wide?: boolean;
  /** Custom node (e.g. a Badge). Overrides `value`. */
  children?: React.ReactNode;
  /** Monospace-style rendering for codes (roll #, employee code, aadhaar). */
  mono?: boolean;
}

export function DetailField({ label, value, wide, children, mono }: DetailFieldProps) {
  const displayValue = children
    ? children
    : value === null || value === undefined || value === '' ? (
        <span className="text-gray-400">—</span>
      ) : (
        <span className={mono ? 'font-mono' : ''}>{value}</span>
      );

  return (
    <div className={wide ? 'md:col-span-full' : ''}>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 break-words">{displayValue}</dd>
    </div>
  );
}

/**
 * Convenience renderer for a boolean flag as a small yes/no label.
 * `trueLabel` / `falseLabel` defaults are "Yes" / "No".
 */
export function DetailBool({
  label, value, trueLabel = 'Yes', falseLabel = 'No',
}: { label: string; value: boolean | undefined | null; trueLabel?: string; falseLabel?: string }) {
  return (
    <DetailField label={label}>
      <span
        className={clsx(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          value ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500',
        )}
      >
        {value ? trueLabel : falseLabel}
      </span>
    </DetailField>
  );
}

/**
 * Formats an ISO date string to locale date. Returns "—" for missing.
 */
export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Extracts the `person` subdocument consistently across populated shapes.
 * Backend responses sometimes populate `personId` (as an object) and
 * sometimes attach it as `person`. This normalizes both.
 */
export function extractPerson(entity: any): any {
  return entity?.person ?? entity?.personId ?? {};
}
