import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import type { DayClosingReport, PaginatedResult } from '../../types'
import Pagination from '../../components/ui/Pagination'
import ConfirmModal from '../../components/ui/ConfirmModal'

export default function DayClosingPage() {
  const [data, setData] = useState<PaginatedResult<DayClosingReport> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDate, setPendingDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const result = await api.dayClosing.list(page, 20)
    setData(result)
    setLoading(false)
  }, [page])

  useEffect(() => { load() }, [load])

  const doGenerate = async (date: string) => {
    setGenerating(true)
    setMessage('')
    try {
      const res = await api.dayClosing.generate(date)
      setMessage(res.updated
        ? 'Day closing report recalculated and updated successfully'
        : 'Day closing report generated successfully')
      load()
    } catch (err) {
      setMessage('Failed to generate report')
    }
    setGenerating(false)
  }

  const handleGenerate = async () => {
    const today = new Date().toISOString().split('T')[0]
    const existing = await api.dayClosing.get(today)
    if (existing) {
      setPendingDate(today)
      setConfirmOpen(true)
      return
    }
    doGenerate(today)
  }

  const columns = [
    { key: 'business_date', label: 'Business Date', render: (r: DayClosingReport) => new Date(r.business_date).toLocaleDateString() },
    { key: 'total_sales', label: 'Total Sales', render: (r: DayClosingReport) => `Rs. ${r.total_sales.toLocaleString()}` },
    { key: 'total_purchases', label: 'Total Purchases', render: (r: DayClosingReport) => `Rs. ${r.total_purchases.toLocaleString()}` },
    { key: 'total_expenses', label: 'Total Expenses', render: (r: DayClosingReport) => `Rs. ${r.total_expenses.toLocaleString()}` },
    {
      key: 'net', label: 'Net Profit',
      render: (r: DayClosingReport) => {
        const net = r.total_sales - r.total_purchases - r.total_expenses
        return <span className={net >= 0 ? 'text-green-600' : 'text-red-600'}>Rs. {net.toLocaleString()}</span>
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Day Closing</h1>
        <button onClick={handleGenerate} disabled={generating}
          className="px-4 py-2 bg-brand-primary text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {generating ? 'Generating...' : 'Generate Today\'s Report'}
        </button>
      </div>

      {message && (
        <div className="px-4 py-3 rounded-xl bg-green-500/10 text-green-600 text-sm">{message}</div>
      )}

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-brand-text-muted">Loading...</div>
        ) : data && data.data.length === 0 ? (
          <div className="text-center py-12 text-brand-text-muted">No closing reports yet</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/20 dark:border-white/[0.06]">
                    {columns.map((col) => (
                      <th key={col.key} className="text-left py-3 px-4 font-medium text-brand-text-muted text-xs uppercase tracking-wider">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20 dark:divide-white/[0.06]">
                  {data?.data.map((row) => (
                    <tr key={row.id} className="hover:bg-white/20 dark:hover:bg-white/[0.04] transition-colors">
                      {columns.map((col) => (
                        <td key={col.key} className="py-3 px-4 text-brand-text-primary dark:text-white">
                          {col.render ? col.render(row) : (row as any)[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && <Pagination page={data.page} total={data.total} limit={20} onChange={setPage} />}
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          doGenerate(pendingDate)
        }}
        title="Report Exists"
        message={`A closing report for ${pendingDate} already exists. Generate again?`}
        confirmLabel="Generate Again"
        cancelLabel="Cancel"
      />
    </div>
  )
}
