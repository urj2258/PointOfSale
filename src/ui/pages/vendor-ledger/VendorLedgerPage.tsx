import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import type { VendorLedgerEntry, PaginatedResult, Vendor, InventoryItem } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import toast from 'react-hot-toast'
import DateInput from '../../components/ui/DateInput'
import DateTimeInput from '../../components/ui/DateTimeInput'

const fmtDate = (d: string) => {
  if (!d) return ''
  const parts = d.split('T')[0].split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}
const toISO = (d: string) => {
  if (!d) return ''
  const parts = d.split('/')
  if (parts.length !== 3) return d
  const [dd, mm, yyyy] = parts.map(p => p.trim())
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return d
  return `${yyyy}-${mm}-${dd}`
}
const fmtDatetime = (dt: string) => {
  if (!dt) return ''
  const [datePart, timePart] = dt.split('T')
  const [y, m, d] = datePart.split('-')
  return `${d}/${m}/${y} ${timePart || ''}`
}
function localNow(): string {
  const n = new Date()
  const dd = String(n.getDate()).padStart(2, '0')
  const mm = String(n.getMonth() + 1).padStart(2, '0')
  const yyyy = n.getFullYear()
  const hh = String(n.getHours()).padStart(2, '0')
  const mi = String(n.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}
const toISODatetime = (dt: string) => {
  if (!dt) return ''
  const [datePart, timePart] = dt.split(' ')
  const parts = datePart.split('/')
  if (parts.length !== 3) return dt
  const [dd, mm, yyyy] = parts.map(p => p.trim())
  return `${yyyy}-${mm}-${dd}T${timePart || '00:00'}`
}

export default function VendorLedgerPage() {
  const [data, setData] = useState<PaginatedResult<VendorLedgerEntry> | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<InventoryItem[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VendorLedgerEntry | null>(null)

  const [filterVendor, setFilterVendor] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [form, setForm] = useState({
    vendor_id: '', product_id: '', transaction_datetime: '',
    quantity: '', rate_per_unit: '', total_payment: '',
    paid_amount: '', description: '', vehicle_number: '',
  })
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)



  const load = useCallback(async () => {
    setLoading(true)
    const result = await api.vendorLedger.list(
      filterVendor || undefined, toISO(filterDateFrom) || undefined, toISO(filterDateTo) || undefined, page, 20
    )
    setData(result)
    setLoading(false)
  }, [filterVendor, filterDateFrom, filterDateTo, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.vendors.list(undefined, 1, 1000).then((r: PaginatedResult<Vendor>) => setVendors(r.data))
    api.inventory.list(undefined, 1, 1000).then((r: PaginatedResult<InventoryItem>) => setProducts(r.data))
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ vendor_id: '', product_id: '', transaction_datetime: localNow(), quantity: '', rate_per_unit: '', total_payment: '', paid_amount: '', description: '', vehicle_number: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (entry: VendorLedgerEntry) => {
    setEditing(entry)
    setForm({
      vendor_id: entry.vendor_id, product_id: entry.product_id,
      transaction_datetime: fmtDatetime(entry.transaction_datetime.slice(0, 16)),
      quantity: String(entry.quantity), rate_per_unit: String(entry.rate_per_unit),
      total_payment: String(entry.total_payment), paid_amount: String(entry.paid_amount),
      description: entry.description || '', vehicle_number: entry.vehicle_number || '',
    })
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.vendor_id || !form.product_id || !form.transaction_datetime) { toast.error('Fill required fields'); return }
    if (Number(form.quantity) <= 0 || Number(form.rate_per_unit) <= 0) { toast.error('Quantity and rate must be positive'); return }
    if (Number(form.paid_amount) > Number(form.total_payment)) { toast.error('Paid amount cannot exceed total payment'); return }
    setError('')
    const isoDt = toISODatetime(form.transaction_datetime)
    try {
      if (editing) {
        await api.vendorLedger.update(editing.id,
          form.vendor_id, form.product_id, isoDt,
          Number(form.quantity), Number(form.rate_per_unit), Number(form.total_payment), Number(form.paid_amount),
          form.description || undefined, form.vehicle_number || undefined)
      } else {
        await api.vendorLedger.create(form.vendor_id, form.product_id, isoDt,
          Number(form.quantity), Number(form.rate_per_unit), Number(form.total_payment), Number(form.paid_amount),
          form.description || undefined, form.vehicle_number || undefined)
      }
      setModalOpen(false)
      load()
      toast.success(editing ? 'Purchase entry updated successfully' : 'Purchase entry created successfully')
    } catch {
      toast.error('Failed to save purchase entry')
    }
  }

  const handleDelete = (entry: VendorLedgerEntry) => {
    setDeletingId(entry.id)
  }

  const remainingBalance = Number(form.total_payment) - Number(form.paid_amount)

  const columns = [
    { key: 'transaction_datetime', label: 'Date', render: (e: VendorLedgerEntry) => new Date(e.transaction_datetime).toLocaleDateString() },
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'product_name', label: 'Product' },
    { key: 'description', label: 'Desc' },
    { key: 'vehicle_number', label: 'Vehicle' },
    { key: 'quantity', label: 'Qty' },
    { key: 'rate_per_unit', label: 'Rate', render: (e: VendorLedgerEntry) => `Rs. ${e.rate_per_unit}` },
    { key: 'total_payment', label: 'Total', render: (e: VendorLedgerEntry) => `Rs. ${e.total_payment.toLocaleString()}` },
    { key: 'paid_amount', label: 'Paid', render: (e: VendorLedgerEntry) => `Rs. ${e.paid_amount.toLocaleString()}` },
    {
      key: 'remaining_balance', label: 'Balance',
      render: (e: VendorLedgerEntry) => (
        <span className={e.remaining_balance < 0 ? 'text-green-600' : e.remaining_balance > 0 ? 'text-red-600' : 'text-gray-500'}>
          Rs. {e.remaining_balance.toLocaleString()}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Vendor Ledger</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-brand-primary text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          New Purchase
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1">Vendor</label>
          <select value={filterVendor} onChange={(e) => { setFilterVendor(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
            <option value="">All Vendors</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1">From</label>
          <DateInput value={filterDateFrom} onChange={(v) => { setFilterDateFrom(v); setPage(1) }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1">To</label>
          <DateInput value={filterDateTo} onChange={(v) => { setFilterDateTo(v); setPage(1) }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
        </div>
        {(filterVendor || filterDateFrom || filterDateTo) && (
          <button onClick={() => { setFilterVendor(''); setFilterDateFrom(''); setFilterDateTo(''); setPage(1) }}
            className="px-3 py-2 text-sm rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:bg-white/30 dark:hover:bg-white/[0.08]">
            Clear
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] overflow-hidden">
        <DataTable columns={columns} data={data?.data ?? []} onEdit={openEdit} onDelete={handleDelete} loading={loading} />
        {data && <Pagination page={data.page} total={data.total} limit={20} onChange={setPage} />}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Purchase' : 'New Purchase'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Vendor *</label>
            <select value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
              <option value="">Select Vendor</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Product *</label>
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
              <option value="">Select Product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Date & Time *</label>
            <DateTimeInput value={form.transaction_datetime} onChange={(v) => setForm({ ...form, transaction_datetime: v })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Quantity *</label>
              <input type="number" value={form.quantity} placeholder="0" onChange={(e) => { const q = e.target.value; const t = Number(q) * Number(form.rate_per_unit); setForm({ ...form, quantity: q, total_payment: t > 0 ? String(t) : '' }) }} onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Rate/Unit *</label>
              <input type="number" value={form.rate_per_unit} placeholder="0" onChange={(e) => { const r = e.target.value; const t = Number(form.quantity) * Number(r); setForm({ ...form, rate_per_unit: r, total_payment: t > 0 ? String(t) : '' }) }} onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
          </div>
          {Number(form.quantity) > 0 && Number(form.rate_per_unit) > 0 && (
            <p className="text-sm text-brand-text-muted">Computed total: <strong>Rs. {(Number(form.quantity) * Number(form.rate_per_unit)).toLocaleString()}</strong></p>
          )}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Total Payment *</label>
              <input type="number" value={form.total_payment} placeholder="0" onChange={(e) => setForm({ ...form, total_payment: e.target.value })} onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Paid Amount *</label>
            <input type="number" value={form.paid_amount} placeholder="0" onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} onFocus={(e) => e.target.select()}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          {remainingBalance >= 0 && (
            <p className="text-sm text-brand-text-muted">Remaining balance: <strong className={remainingBalance === 0 ? 'text-green-600' : 'text-orange-600'}>Rs. {remainingBalance.toLocaleString()}</strong></p>
          )}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Vehicle Number</label>
            <input type="text" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:bg-white/30 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 text-sm rounded-xl bg-brand-primary text-gray-900 font-medium hover:opacity-90">Save</button>
          </div>
        </div>
      </Modal>
      <ConfirmModal open={deletingId !== null} onClose={() => setDeletingId(null)}
        onConfirm={async () => { if (deletingId) { try { await api.vendorLedger.delete(deletingId); toast.success('Purchase entry deleted successfully') } catch { toast.error('Failed to delete purchase entry') } setDeletingId(null); load() } }}
        title="Delete Purchase Entry"
        message="Are you sure you want to delete this purchase entry? This action cannot be undone."
        confirmLabel="Delete" danger />
    </div>
  )
}