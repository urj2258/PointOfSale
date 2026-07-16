interface Column<T> {
  key: string
  label: string
  render?: (item: T) => React.ReactNode
  sortable?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  onRowClick?: (item: T) => void
  loading?: boolean
}

export default function DataTable<T extends Record<string, any>>({ columns, data, onEdit, onDelete, onRowClick, loading }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="text-center py-12 text-brand-text-muted">
        Loading...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-brand-text-muted">
        No records found
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/20 dark:border-white/[0.06]">
            {columns.map((col) => (
              <th key={col.key} className="text-left py-3 px-4 font-medium text-brand-text-muted text-xs uppercase tracking-wider">
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th className="text-right py-3 px-4 font-medium text-brand-text-muted text-xs uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/20 dark:divide-white/[0.06]">
          {data.map((item, i) => (
            <tr 
              key={item.id ?? i} 
              onClick={() => onRowClick?.(item)}
              className={`hover:bg-white/20 dark:hover:bg-white/[0.04] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4 text-brand-text-primary dark:text-white">
                  {col.render ? col.render(item) : item[col.key]}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onEdit && (
                      <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-1.5 rounded-lg hover:bg-white/30 dark:hover:bg-white/[0.08] text-brand-text-muted hover:text-brand-text-primary transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-brand-text-muted hover:text-red-600 transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
