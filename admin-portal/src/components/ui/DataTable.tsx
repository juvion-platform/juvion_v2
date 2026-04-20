interface Column<T> { key: string; label: string; render?: (row: T) => React.ReactNode; }

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: React.ReactNode;
  /**
   * Returns extra props to spread onto each `<tr>`. Used by `useHighlightRow`
   * to tag rows with `data-highlight-id` for scroll-to + flash when arriving
   * from global-people-search. Optional; existing callers unaffected.
   */
  rowProps?: (row: T, index: number) => Record<string, string | number | boolean | undefined>;
  /**
   * Returns a stable id for the row, used as the React key. When omitted,
   * falls back to the array index (preserves old behavior).
   */
  rowKey?: (row: T, index: number) => string | number;
}

export default function DataTable<T extends Record<string, any>>({
  columns, data, onRowClick, loading, emptyState, rowProps, rowKey,
}: Props<T>) {
  if (loading) return <div className="text-center py-10 text-gray-400">Loading...</div>;
  return (
    <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 text-left font-medium text-gray-600">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                {emptyState || 'No data found'}
              </td>
            </tr>
          ) : data.map((row, i) => {
            const extra = rowProps ? rowProps(row, i) : undefined;
            const key = rowKey ? rowKey(row, i) : i;
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                {...extra}
              >
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
