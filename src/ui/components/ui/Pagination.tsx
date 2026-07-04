interface PaginationProps {
  page: number
  total: number
  limit: number
  onChange: (page: number) => void
}

export default function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/20 dark:border-white/[0.06]">
      <span className="text-sm text-brand-text-muted">
        Showing {Math.min((page - 1) * limit + 1, total)}-{Math.min(page * limit, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-3 py-1.5 text-sm rounded-lg border border-white/20 dark:border-white/[0.06] disabled:opacity-30 hover:bg-white/30 dark:hover:bg-white/[0.08] transition-colors"
        >
          Prev
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number
          if (totalPages <= 5) {
            pageNum = i + 1
          } else if (page <= 3) {
            pageNum = i + 1
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i
          } else {
            pageNum = page - 2 + i
          }
          return (
            <button
              key={pageNum}
              onClick={() => onChange(pageNum)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                pageNum === page
                  ? 'bg-brand-primary text-gray-900'
                  : 'hover:bg-white/30 dark:hover:bg-white/[0.08] text-brand-text-muted'
              }`}
            >
              {pageNum}
            </button>
          )
        })}
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="px-3 py-1.5 text-sm rounded-lg border border-white/20 dark:border-white/[0.06] disabled:opacity-30 hover:bg-white/30 dark:hover:bg-white/[0.08] transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
