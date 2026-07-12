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

  // Vendor mode: 'existing' = dropdown, 'new' = inline form
  const [vendorMode, setVendorMode] = useState<'existing' | 'new'>('existing')
  const [newVendorForm, setNewVendorForm] = useState({ name: '', phone: '', address: '', mill_name: '' })
  const [newVendorErrors, setNewVendorErrors] = useState<Record<string, string>>({})
  const [newVendorTouched, setNewVendorTouched] = useState<Record<string, boolean>>({})

  const [form, setForm] = useState({
    vendor_id: '', transaction_datetime: '',
    total_payment: '', paid_amount: '', description: '', vehicle_number: '', due_date: '',
  })
  const [items, setItems] = useState([{ product_id: '', quantity: '', rate_per_unit: '' }])
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
    setVendorMode('existing')
    setNewVendorForm({ name: '', phone: '', address: '', mill_name: '' })
    setNewVendorErrors({})
    setNewVendorTouched({})
    setItems([{ product_id: '', quantity: '', rate_per_unit: '' }])
    setForm({ vendor_id: '', transaction_datetime: localNow(), total_payment: '', paid_amount: '', description: '', vehicle_number: '', due_date: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = async (entry: VendorLedgerEntry) => {
    setEditing(entry)
    setVendorMode('existing')
    setNewVendorForm({ name: '', phone: '', address: '', mill_name: '' })
    setNewVendorErrors({})
    setNewVendorTouched({})

    // Pre-fill due_date from the joined invoice_due_date field
    const rawDueDate = entry.invoice_due_date || ''
    const preDueDate = rawDueDate ? fmtDate(rawDueDate) : ''

    // Fetch real line items from vendor_invoice_items
    if (entry.vendor_invoice_id) {
      try {
        const invoice = await api.vendorInvoices.getWithItems(entry.vendor_invoice_id) as any
        const invoiceItems = invoice?.items ?? []
        if (invoiceItems.length > 0) {
          setItems(invoiceItems.map((it: any) => ({
            product_id: it.product_id,
            quantity: String(it.quantity),
            rate_per_unit: String(it.rate_per_unit),
          })))
        } else {
          // Fallback: single row from ledger aggregation
          setItems([{ product_id: entry.product_id, quantity: String(entry.quantity), rate_per_unit: String(entry.rate_per_unit) }])
        }
      } catch {
        // Fallback on error
        setItems([{ product_id: entry.product_id, quantity: String(entry.quantity), rate_per_unit: String(entry.rate_per_unit) }])
      }
    } else {
      setItems([{ product_id: entry.product_id, quantity: String(entry.quantity), rate_per_unit: String(entry.rate_per_unit) }])
    }

    setForm({
      vendor_id: entry.vendor_id,
      transaction_datetime: fmtDatetime(entry.transaction_datetime.slice(0, 16)),
      total_payment: String(entry.total_payment), paid_amount: String(entry.paid_amount),
      description: entry.description || '', vehicle_number: entry.vehicle_number || '',
      due_date: preDueDate,
    })
    setError('')
    setModalOpen(true)
  }

  // Inline new-vendor field validation (mirrors VendorsPage.tsx exactly)
  const validateNewVendorField = (field: string, value: string): string | undefined => {
    const v = value.trim()
    if (field === 'name') {
      if (!v) return 'Name is required.'
      if (v.length < 3 || v.length > 100) return 'Name must be 3-100 characters.'
      if (/^\d+$/.test(v)) return 'Name cannot be purely numbers.'
      if (/^[^a-zA-Z0-9]+$/.test(v)) return 'Name must contain at least one letter or digit.'
    }
    if (field === 'phone') {
      if (!v) return 'Phone is required.'
      if (/[^0-9+\-\s()]/.test(v)) return 'Phone must not contain letters.'
      const digits = v.replace(/[^0-9]/g, '')
      const ok = /^03\d{9}$/.test(digits) || /^923\d{9}$/.test(digits) || /^3\d{9}$/.test(digits) || /^0[24-9]\d{8,9}$/.test(digits) || /^92[24-9]\d{8,9}$/.test(digits)
      if (!ok) return 'Enter a valid Pakistani phone number (e.g. 03XXXXXXXXX).'
    }
    if (field === 'address') {
      if (!v) return 'Address is required.'
      if (v.length < 5 || v.length > 250) return 'Address must be 5-250 characters.'
      if (/^\d+$/.test(v)) return 'Address cannot be purely numbers.'
      if (/^[^a-zA-Z0-9]+$/.test(v)) return 'Address must contain at least one letter or digit.'
    }
    if (field === 'mill_name' && value.trim()) {
      if (value.trim().length < 3 || value.trim().length > 100) return 'Mill name must be 3-100 characters.'
    }
    return undefined
  }

  const handleSubmit = async () => {
    if (vendorMode === 'new' && !editing) {
      const nvErrors: Record<string, string> = {}
      for (const f of ['name', 'phone', 'address', 'mill_name']) {
        const err = validateNewVendorField(f, newVendorForm[f as keyof typeof newVendorForm])
        if (err) nvErrors[f] = err
      }
      setNewVendorTouched({ name: true, phone: true, address: true, mill_name: true })
      setNewVendorErrors(nvErrors)
      if (Object.keys(nvErrors).length > 0) { toast.error('Please fix vendor field errors.'); return }
    }
    if (vendorMode === 'existing' && !form.vendor_id) { toast.error('Please select a vendor.'); return }
    if (!form.transaction_datetime) { toast.error('Fill required fields'); return }

    // Due date validation: must not be before purchase date
    if (form.due_date) {
      const purchaseISO = toISO(form.transaction_datetime.split(' ')[0])
      const dueISO = toISO(form.due_date)
      if (dueISO && purchaseISO && dueISO < purchaseISO) {
        toast.error('Due date cannot be earlier than the purchase date')
        return
      }
    }

    if (items.length === 0) { toast.error('Add at least one item'); return }
    for (const item of items) {
      if (!item.product_id) { toast.error('Select a product for all rows'); return }
      if (Number(item.quantity) <= 0 || Number(item.rate_per_unit) <= 0) { toast.error('Quantity and rate must be positive for all items'); return }
    }

    if (Number(form.paid_amount) > Number(form.total_payment)) { toast.error('Paid amount cannot exceed total payment'); return }
    setError('')
    const isoDt = toISODatetime(form.transaction_datetime)
    const isoDueDate = form.due_date ? toISO(form.due_date) : undefined
    const formattedItems = items.map(it => ({
      productId: it.product_id,
      quantity: Number(it.quantity),
      ratePerUnit: Number(it.rate_per_unit)
    }))
    try {
      if (editing) {
        await api.vendorLedger.update(editing.id,
          form.vendor_id, isoDt, formattedItems,
          Number(form.total_payment), Number(form.paid_amount),
          form.description || undefined, form.vehicle_number || undefined, isoDueDate)
      } else if (vendorMode === 'new') {
        const result = await api.vendorLedger.createWithNewVendor(
          { name: newVendorForm.name, phone: newVendorForm.phone, address: newVendorForm.address, mill_name: newVendorForm.mill_name || undefined },
          { items: formattedItems, transactionDatetime: isoDt, totalPayment: Number(form.total_payment), paidAmount: Number(form.paid_amount), description: form.description || undefined, vehicleNumber: form.vehicle_number || undefined, dueDate: isoDueDate }
        )
        if ((result as any)?.error) { toast.error((result as any).error); return }
        api.vendors.list(undefined, 1, 1000).then((r: PaginatedResult<Vendor>) => setVendors(r.data))
      } else {
        await api.vendorLedger.create(form.vendor_id, isoDt, formattedItems,
          Number(form.total_payment), Number(form.paid_amount),
          form.description || undefined, form.vehicle_number || undefined, isoDueDate)
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
      key: 'remaining_balance', label: 'Remaining Balance',
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-brand-text-primary dark:text-white">Vendor *</label>
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setVendorMode(v => v === 'existing' ? 'new' : 'existing')
                    setNewVendorErrors({})
                    setNewVendorTouched({})
                    setNewVendorForm({ name: '', phone: '', address: '', mill_name: '' })
                  }}
                  className="text-xs font-medium text-gray-900 dark:text-white hover:underline"
                >
                  {vendorMode === 'existing' ? '+ Add New Vendor' : '← Existing Vendor'}
                </button>
              )}
            </div>

            {vendorMode === 'existing' || editing ? (
              <select value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                <option value="">Select Vendor</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            ) : (
              <div className="space-y-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">New vendor details — will be saved when you submit</p>
                {(['name', 'phone', 'address', 'mill_name'] as const).map(field => (
                  <div key={field}>
                    <input
                      type="text"
                      value={newVendorForm[field]}
                      placeholder={field === 'name' ? 'Vendor Name *' : field === 'phone' ? 'Phone Number *' : field === 'address' ? 'Address *' : 'Mill Name (optional)'}
                      onChange={e => {
                        const val = e.target.value
                        setNewVendorForm(prev => ({ ...prev, [field]: val }))
                        if (newVendorTouched[field]) {
                          const err = validateNewVendorField(field, val)
                          setNewVendorErrors(prev => ({ ...prev, [field]: err ?? '' }))
                        }
                      }}
                      onBlur={() => {
                        setNewVendorTouched(prev => ({ ...prev, [field]: true }))
                        const err = validateNewVendorField(field, newVendorForm[field])
                        setNewVendorErrors(prev => ({ ...prev, [field]: err ?? '' }))
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                    />
                    {newVendorTouched[field] && newVendorErrors[field] && (
                      <p className="text-xs text-red-500 mt-1">{newVendorErrors[field]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4 bg-gray-50/50 dark:bg-white/[0.02] p-4 rounded-xl border border-gray-100 dark:border-white/[0.05]">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-brand-text-primary dark:text-white">Purchase Items</h3>
              <button type="button" onClick={() => setItems([...items, { product_id: '', quantity: '', rate_per_unit: '' }])} className="text-xs font-medium text-gray-900 dark:text-white hover:underline">
                + Add Item
              </button>
            </div>
            
            {items.map((item, idx) => (
              <div key={idx} className="relative grid grid-cols-12 gap-3 items-end bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                {items.length > 1 && (
                  <button type="button" onClick={() => {
                    const newItems = items.filter((_, i) => i !== idx)
                    setItems(newItems)
                    const gt = newItems.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate_per_unit)), 0)
                    setForm(f => ({ ...f, total_payment: String(gt) }))
                  }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200">
                    ×
                  </button>
                )}
                <div className="col-span-5">
                  <label className="block text-xs font-medium text-brand-text-primary dark:text-gray-300 mb-1">Product *</label>
                  <select value={item.product_id} onChange={(e) => { const newItems = [...items]; newItems[idx].product_id = e.target.value; setItems(newItems); }}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                    <option value="">Select Product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-brand-text-primary dark:text-gray-300 mb-1">Qty *</label>
                  <input type="number" value={item.quantity} placeholder="0" 
                    onChange={(e) => { 
                      const newItems = [...items]; 
                      newItems[idx].quantity = e.target.value; 
                      setItems(newItems);
                      const gt = newItems.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate_per_unit)), 0);
                      setForm(f => ({ ...f, total_payment: String(gt) }));
                    }} 
                    onFocus={(e) => e.target.select()}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                </div>
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-brand-text-primary dark:text-gray-300 mb-1">Rate *</label>
                  <input type="number" value={item.rate_per_unit} placeholder="0" 
                    onChange={(e) => { 
                      const newItems = [...items]; 
                      newItems[idx].rate_per_unit = e.target.value; 
                      setItems(newItems);
                      const gt = newItems.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate_per_unit)), 0);
                      setForm(f => ({ ...f, total_payment: String(gt) }));
                    }} 
                    onFocus={(e) => e.target.select()}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                </div>
                {Number(item.quantity) > 0 && Number(item.rate_per_unit) > 0 && (
                  <div className="col-span-12 text-right">
                    <p className="text-xs text-brand-text-muted">Line Total: <strong>Rs. {(Number(item.quantity) * Number(item.rate_per_unit)).toLocaleString()}</strong></p>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-white/[0.1]">
              <p className="text-sm font-semibold text-brand-text-primary dark:text-white">
                Grand Total: Rs. {items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate_per_unit)), 0).toLocaleString()}
              </p>
            </div>
          </div>
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
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Purchase Date *</label>
            <DateTimeInput value={form.transaction_datetime} onChange={(v) => setForm({ ...form, transaction_datetime: v })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Due Date <span className="text-brand-text-muted font-normal text-xs">(optional — leave blank if not on credit)</span></label>
            <DateInput value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            {form.due_date && form.transaction_datetime && toISO(form.due_date) < toISO(form.transaction_datetime.split(' ')[0]) && (
              <p className="text-xs text-red-500 mt-1">Due date cannot be earlier than the purchase date</p>
            )}
          </div>
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