import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import type { VendorLedgerEntry, PaginatedResult, Vendor, InventoryItem } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'

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
    quantity: 0, rate_per_unit: 0, total_payment: 0,
    paid_amount: 0, description: '', vehicle_number: '',
  })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const result = await api.vendorLedger.list(
      filterVendor || undefined, filterDateFrom || undefined, filterDateTo || undefined, page, 20
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
    const now = new Date().toISOString().slice(0, 16)
    setEditing(null)
    setForm({ vendor_id: '', product_id: '', transaction_datetime: now, quantity: 0, rate_per_unit: 0, total_payment: 0, paid_amount: 0, description: '', vehicle_number: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (entry: VendorLedgerEntry) => {
    setEditing(entry)
    setForm({
      vendor_id: entry.vendor_id, product_id: entry.product_id,
      transaction_datetime: entry.transaction_datetime.slice(0, 16),
      quantity: entry.quantity, rate_per_unit: entry.rate_per_unit,
      total_payment: entry.total_payment, paid_amount: entry.paid_amount,
      description: entry.description || '', vehicle_number: entry.vehicle_number || '',
    })
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.vendor_id || !form.product_id || !form.transaction_datetime) { setError('Fill required fields'); return }
    if (form.quantity <= 0 || form.rate_per_unit <= 0) { setError('Quantity and rate must be positive'); return }
    if (form.paid_amount > form.total_payment) { setError('Paid amount cannot exceed total payment'); return }
    setError('')
    if (editing) {
      await api.vendorLedger.update(editing.id, form.paid_amount, form.description || undefined, form.vehicle_number || undefined)
    } else {
      await api.vendorLedger.create(form.vendor_id, form.product_id, form.transaction_datetime,
        form.quantity, form.rate_per_unit, form.total_payment, form.paid_amount,
        form.description || undefined, form.vehicle_number || undefined)
    }
    setModalOpen(false)
    load()
  }

  const handleDelete = async (entry: VendorLedgerEntry) => {
    if (confirm('Delete this purchase entry?')) {
      await api.vendorLedger.delete(entry.id)
      load()
    }
  }

  const remainingBalance = form.total_payment - form.paid_amount

  const columns = [
    { key: 'transaction_datetime', label: 'Date', render: (e: VendorLedgerEntry) => new Date(e.transaction_datetime).toLocaleDateString() },
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'product_name', label: 'Product' },
    { key: 'quantity', label: 'Qty' },
    { key: 'rate_per_unit', label: 'Rate', render: (e: VendorLedgerEntry) => `Rs. ${e.rate_per_unit}` },
    { key: 'total_payment', label: 'Total', render: (e: VendorLedgerEntry) => `Rs. ${e.total_payment.toLocaleString()}` },
    { key: 'paid_amount', label: 'Paid', render: (e: VendorLedgerEntry) => `Rs. ${e.paid_amount.toLocaleString()}` },
    {
      key: 'remaining_balance', label: 'Balance',
      render: (e: VendorLedgerEntry) => (
        <span className={e.remaining_balance === 0 ? 'text-green-600' : 'text-orange-600'}>
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
            className="px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
            <option value="">All Vendors</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1">From</label>
          <input type="date" value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1">To</label>
          <input type="date" value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
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
          {!editing && (
            <>
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Vendor *</label>
                <select value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Product *</label>
                <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                  <option value="">Select Product</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Date & Time *</label>
                <input type="datetime-local" value={form.transaction_datetime} onChange={(e) => setForm({ ...form, transaction_datetime: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Quantity *</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Rate/Unit *</label>
                  <input type="number" value={form.rate_per_unit} onChange={(e) => setForm({ ...form, rate_per_unit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
                </div>
              </div>
              {form.quantity > 0 && form.rate_per_unit > 0 && (
                <p className="text-sm text-brand-text-muted">Computed total: <strong>Rs. {(form.quantity * form.rate_per_unit).toLocaleString()}</strong></p>
              )}
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Total Payment *</label>
                <input type="number" value={form.total_payment} onChange={(e) => setForm({ ...form, total_payment: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Paid Amount *</label>
                <input type="number" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
              </div>
              {remainingBalance >= 0 && (
                <p className="text-sm text-brand-text-muted">Remaining balance: <strong className={remainingBalance === 0 ? 'text-green-600' : 'text-orange-600'}>Rs. {remainingBalance.toLocaleString()}</strong></p>
              )}
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Vehicle Number</label>
                <input type="text" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
              </div>
            </>
          )}
          {editing && (
            <>
              <p className="text-sm text-brand-text-muted">Editing payment for purchase entry only. Use delete + recreate to change other fields.</p>
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Paid Amount *</label>
                <input type="number" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:bg-white/30 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 text-sm rounded-xl bg-brand-primary text-gray-900 font-medium hover:opacity-90">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
