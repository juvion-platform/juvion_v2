interface Column<T> { key: string; label: string; render?: (row: T) => React.ReactNode; }

interface Props<T> { columns: Column<T>[]; data: T[]; onRowClick?: (row: T) => void; loading?: boolean; }

export default function DataTable<T extends Record<string, any>>({ columns, data, onRowClick, loading }: Props<T>) {
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
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">No data found</td></tr>
          ) : data.map((row, i) => (
            <tr key={i} onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}>
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3">{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
