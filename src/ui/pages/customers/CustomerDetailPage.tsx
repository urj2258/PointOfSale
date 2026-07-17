import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import type { Customer, CustomerLedgerEntry, PaginatedResult } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import DateInput from '../../components/ui/DateInput'
import toast from 'react-hot-toast'

// Convert a dd/mm/yyyy display string (from DateInput) to YYYY-MM-DD for the API
function displayToIso(display: string): string {
  const [dd, mm, yyyy] = display.split('/')
  return `${yyyy}-${mm}-${dd}`
}

// Parse dd/mm/yyyy into a Date for DateInput's minDate prop
const parseDisplay = (d: string): Date | undefined => {
  if (!d) return undefined
  const [dd, mm, yyyy] = d.split('/')
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
}

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [data, setData] = useState<PaginatedResult<CustomerLedgerEntry> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Export State
  const [exporting, setExporting] = useState(false)
  const [summaryFromDate, setSummaryFromDate] = useState('')
  const [summaryToDate, setSummaryToDate] = useState('')
  const [exportDir, setExportDir] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    try {
      const c = await api.customers.get(customerId)
      setCustomer(c)
      const result = await api.customerLedger.list(customerId, undefined, undefined, page, 20)
      setData(result)
    } catch {
      toast.error('Failed to load customer data')
    }
    setLoading(false)
  }, [customerId, page])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    api.dayClosing.getExportDir().then(dir => setExportDir(dir))
  }, [])

  const handleChangeDir = async () => {
    const res = await api.dayClosing.chooseExportDir()
    if (res.success) setExportDir(res.path)
  }

  const handleExportSummary = async () => {
    if (!customerId) return
    const hasFrom = !!summaryFromDate
    const hasTo = !!summaryToDate

    if (hasFrom !== hasTo) {
      toast.error('Please select both a from and to date, or leave both empty for the full summary')
      return
    }

    if (hasFrom && hasTo) {
      const fromIso = displayToIso(summaryFromDate)
      const toIso = displayToIso(summaryToDate)
      if (fromIso > toIso) {
        toast.error('Invalid date range! From date cannot be after To date.')
        return
      }
    }

    setExporting(true)
    try {
      const res = await api.customerLedger.exportExcel(
        customerId,
        hasFrom ? displayToIso(summaryFromDate) : undefined,
        hasTo ? displayToIso(summaryToDate) : undefined,
      )
      if (res.canceled) {
        setExporting(false)
        return
      }
      if ((res as any).error) {
        toast.error((res as any).error)
        setExporting(false)
        return
      }
      if (res.success) {
        toast.success(`Summary exported to ${res.path}`)
      }
    } catch {
      toast.error('Failed to export ledger summary')
    }
    setExporting(false)
  }

  const columns = [
    { key: 'transaction_datetime', label: 'Date', render: (e: CustomerLedgerEntry) => new Date(e.transaction_datetime).toLocaleDateString() },
    { key: 'invoice_number', label: 'Invoice #', render: (e: CustomerLedgerEntry & { invoice_number?: string }) => e.invoice_number || '-' },
    { key: 'product_name', label: 'Product', render: (e: CustomerLedgerEntry) => e.product_name || '-' },
    { key: 'description', label: 'Desc' },
    { key: 'vehicle_number', label: 'Vehicle' },
    { key: 'quantity', label: 'Qty', render: (e: CustomerLedgerEntry) => e.quantity ?? '-' },
    { key: 'rate_per_unit', label: 'Rate', render: (e: CustomerLedgerEntry) => e.rate_per_unit != null ? `Rs. ${e.rate_per_unit}` : '-' },
    { key: 'total_payment', label: 'Total', render: (e: CustomerLedgerEntry) => `Rs. ${e.total_payment.toLocaleString()}` },
    { key: 'paid_amount', label: 'Paid', render: (e: CustomerLedgerEntry) => `Rs. ${e.paid_amount.toLocaleString()}` },
    {
      key: 'remaining_balance', label: 'Remaining Balance',
      render: (e: CustomerLedgerEntry) => (
        <span className={e.remaining_balance > 0 ? 'text-red-600' : e.remaining_balance < 0 ? 'text-green-600' : 'text-gray-500'}>
          Rs. {e.remaining_balance.toLocaleString()}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/customers')}
          className="p-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.08] transition-colors text-brand-text-muted hover:text-brand-text-primary"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">
            {customer ? customer.name : 'Loading Customer...'}
          </h1>
          {customer && (
            <p className="text-sm text-brand-text-muted">{customer.phone} · {customer.address}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-4">
        <p className="text-sm font-semibold text-brand-text-primary dark:text-white mb-3">
          Export Ledger
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <DateInput
            value={summaryFromDate}
            onChange={setSummaryFromDate}
            placeholder="From (dd/mm/yyyy)"
            className="px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.08] text-brand-text-primary dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary w-40 cursor-pointer"
          />

          <DateInput
            value={summaryToDate}
            onChange={setSummaryToDate}
            placeholder="To (dd/mm/yyyy)"
            minDate={parseDisplay(summaryFromDate)}
            className="px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.08] text-brand-text-primary dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary w-40 cursor-pointer"
          />

          <button
            onClick={handleExportSummary}
            disabled={exporting}
            className="px-4 py-2 bg-brand-primary text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export Summary'}
          </button>

          {exportDir && (
            <span className="text-xs text-brand-text-muted max-w-[200px] truncate" title={exportDir}>
              {exportDir.split(/[/\\]/).pop()}
            </span>
          )}
          <button onClick={handleChangeDir}
            className="px-3 py-2 bg-white/60 dark:bg-white/[0.08] text-brand-text-muted dark:text-gray-400 border border-white/30 dark:border-white/[0.1] rounded-xl text-xs font-medium hover:opacity-90 transition-opacity">
            {exportDir ? 'Change Folder' : 'Set Folder'}
          </button>

          {(summaryFromDate || summaryToDate) && (
            <button
              onClick={() => { setSummaryFromDate(''); setSummaryToDate('') }}
              className="text-xs text-brand-text-muted hover:text-red-500 transition-colors"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] overflow-hidden">
        <DataTable columns={columns} data={data?.data ?? []} loading={loading} />
        {data && <Pagination page={data.page} total={data.total} limit={20} onChange={setPage} />}
      </div>
    </div>
  )
}
