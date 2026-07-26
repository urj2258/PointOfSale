import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import type { Vendor, VendorLedgerEntry, PaginatedResult } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import DateInput from '../../components/ui/DateInput'
import VendorPurchaseModal from '../../components/vendors/VendorPurchaseModal'
import ConfirmModal from '../../components/ui/ConfirmModal'
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

export default function VendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>()
  const navigate = useNavigate()

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [data, setData] = useState<PaginatedResult<VendorLedgerEntry> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [runningBalance, setRunningBalance] = useState<number | null>(null)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<VendorLedgerEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const openEdit = (entry: VendorLedgerEntry) => {
    if (entry.transaction_type === 'payment') {
      toast.error('Payment entries cannot be edited')
      return
    }
    setEditingEntry(entry)
    setPurchaseModalOpen(true)
  }

  const handleDelete = (entry: VendorLedgerEntry) => {
    setDeletingId(entry.id)
  }

  // Export State
  const [exporting, setExporting] = useState(false)
  const [summaryFromDate, setSummaryFromDate] = useState('')
  const [summaryToDate, setSummaryToDate] = useState('')
  const [exportDir, setExportDir] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!vendorId) return
    setLoading(true)
    try {
      const v = await api.vendors.get(vendorId)
      setVendor(v)
      const result = await api.vendorLedger.list(vendorId, undefined, undefined, page, 20)
      setData(result)
      const rb = await api.vendors.runningBalance(vendorId)
      setRunningBalance(rb)
    } catch {
      toast.error('Failed to load vendor data')
    }
    setLoading(false)
  }, [vendorId, page])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    api.dayClosing.getExportDir().then((dir: string) => setExportDir(dir))
  }, [])

  const handleChangeDir = async () => {
    const res = await api.dayClosing.chooseExportDir()
    if (res.success) setExportDir(res.path)
  }

  const handleExportSummary = async () => {
    if (!vendorId) return
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
      const res = await api.vendorLedger.exportExcel(
        vendorId,
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
    { key: 'transaction_datetime', label: 'Date', render: (e: VendorLedgerEntry) => new Date(e.transaction_datetime).toLocaleDateString() },
    { key: 'transaction_type', label: 'Type', render: (e: VendorLedgerEntry) => (
      <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (e.transaction_type === 'payment' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400')}>
        {e.transaction_type === 'payment' ? 'Payment' : 'Purchase'}
      </span>
    )},
    {
      key: 'product_name', label: 'Product',
      render: (e: VendorLedgerEntry) => {
        if (e.transaction_type === 'payment') return '-'
        const items = e.items
        if (!items || items.length === 0) return e.product_name || '-'
        return (
          <div className="space-y-0.5">
            {items.map((it, i) => <div key={i}>{it.name}</div>)}
          </div>
        )
      },
    },
    { key: 'description', label: 'Desc' },
    { key: 'vehicle_number', label: 'Vehicle', render: (e: VendorLedgerEntry) => e.transaction_type === 'payment' ? '-' : (e.vehicle_number || '-') },
    {
      key: 'quantity', label: 'Qty',
      render: (e: VendorLedgerEntry) => {
        if (e.transaction_type === 'payment') return '-'
        const items = e.items
        if (!items || items.length === 0) return e.quantity ?? '-'
        return (
          <div className="space-y-0.5">
            {items.map((it, i) => <div key={i}>{it.quantity}</div>)}
          </div>
        )
      },
    },
    {
      key: 'rate_per_unit', label: 'Rate',
      render: (e: VendorLedgerEntry) => {
        if (e.transaction_type === 'payment') return '-'
        const items = e.items
        if (!items || items.length === 0) return `Rs. ${e.rate_per_unit ?? 0}`
        return (
          <div className="space-y-0.5">
            {items.map((it, i) => <div key={i}>Rs. {it.rate}</div>)}
          </div>
        )
      },
    },
    { key: 'total_payment', label: 'Total', render: (e: VendorLedgerEntry) => `Rs. ${e.total_payment.toLocaleString()}` },
    { key: 'paid_amount', label: 'Paid', render: (e: VendorLedgerEntry) => `Rs. ${e.paid_amount.toLocaleString()}` },
    {
      key: 'remaining_balance', label: 'Remaining Balance',
      render: (e: VendorLedgerEntry) => {
        const rb = e.running_balance!
        return (
          <span className={rb < 0 ? 'text-red-600' : rb > 0 ? 'text-green-600' : 'text-gray-500'}>
            {rb > 0 ? '+ ' : rb < 0 ? '- ' : ''}Rs. {Math.abs(rb).toLocaleString()}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/vendors')}
          className="p-2 rounded-xl border border-[#D1D5DB] dark:border-white/[0.1] bg-white dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors text-brand-text-muted hover:text-brand-text-primary"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">
            {vendor ? vendor.name : 'Loading Vendor...'}
          </h1>
          {vendor && (
            <p className="text-sm text-brand-text-muted">{vendor.phone} · {vendor.address}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-brand-card dark:bg-white/[0.04] border-brand-border dark:border-white/[0.06] p-4">
        <p className="text-sm font-semibold text-brand-text-primary dark:text-white mb-3">
          Export Ledger
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <DateInput
            value={summaryFromDate}
            onChange={setSummaryFromDate}
            placeholder="From (dd/mm/yyyy)"
            className="px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-white/[0.1] bg-white dark:bg-white/[0.08] text-brand-text-primary dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary w-40 cursor-pointer"
          />

          <DateInput
            value={summaryToDate}
            onChange={setSummaryToDate}
            placeholder="To (dd/mm/yyyy)"
            minDate={parseDisplay(summaryFromDate)}
            className="px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-white/[0.1] bg-white dark:bg-white/[0.08] text-brand-text-primary dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary w-40 cursor-pointer"
          />

          <button
            onClick={handleExportSummary}
            disabled={exporting}
            className="px-4 py-2 bg-[#6B7280] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export Summary'}
          </button>

          {exportDir && (
            <span className="text-xs text-brand-text-muted max-w-[200px] truncate" title={exportDir}>
              {exportDir.split(/[/\\]/).pop()}
            </span>
          )}
          <button onClick={handleChangeDir}
            className="px-3 py-2 bg-white dark:bg-white/[0.08] text-brand-text-muted dark:text-gray-400 border border-[#D1D5DB] dark:border-white/[0.1] rounded-xl text-xs font-medium hover:opacity-90 transition-opacity">
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

      <div className="flex justify-end">
        <button onClick={() => setPurchaseModalOpen(true)} disabled={!vendorId}
          className="px-4 py-2 bg-[#6B7280] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          New Purchase
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-brand-card dark:bg-white/[0.04] border-brand-border dark:border-white/[0.06] px-5 py-4">
          <p className="text-sm text-brand-text-muted">Opening Balance</p>
          <p className={`text-2xl font-bold mt-1 ${(vendor?.opening_balance ?? 0) > 0 ? 'text-green-600' : (vendor?.opening_balance ?? 0) < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {(vendor?.opening_balance ?? 0) > 0 ? '+ ' : (vendor?.opening_balance ?? 0) < 0 ? '- ' : ''}Rs. {Math.abs(vendor?.opening_balance ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-brand-card dark:bg-white/[0.04] border-brand-border dark:border-white/[0.06] px-5 py-4">
          <p className="text-sm text-brand-text-muted">Remaining Balance</p>
          <p className={`text-2xl font-bold mt-1 ${(runningBalance ?? 0) > 0 ? 'text-green-600' : (runningBalance ?? 0) < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {(runningBalance ?? 0) > 0 ? '+ ' : (runningBalance ?? 0) < 0 ? '- ' : ''}Rs. {Math.abs(runningBalance ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-brand-card dark:bg-white/[0.04] border-brand-border dark:border-white/[0.06] overflow-hidden">
        <DataTable columns={columns} data={data?.data ?? []} onEdit={openEdit} onDelete={handleDelete} loading={loading} />
        {data && <Pagination page={data.page} total={data.total} limit={20} onChange={setPage} />}
      </div>

      {vendorId && (
        <VendorPurchaseModal
          open={purchaseModalOpen}
          onClose={() => { setPurchaseModalOpen(false); setEditingEntry(null) }}
          onSuccess={loadData}
          lockedVendorId={vendorId}
          editEntry={editingEntry ?? undefined}
        />
      )}
      <ConfirmModal open={deletingId !== null} onClose={() => setDeletingId(null)}
        onConfirm={async () => { if (deletingId) { try { await api.vendorLedger.delete(deletingId); toast.success('Entry deleted successfully') } catch { toast.error('Failed to delete entry') } setDeletingId(null); loadData() } }}
        title="Delete Entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        confirmLabel="Delete" danger />
    </div>
  )
}
