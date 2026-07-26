import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../services/api'
import type { CustomerLedgerEntry, PaginatedResult, Customer, InventoryItem } from '../../types'
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

// ── New-customer inline validation ──────
type NewCustomerForm = { name: string; phone: string; address: string; shop_name: string; obAmount: string; obDirection: 'customer_owes_us' | 'we_owe_customer' }
type NewCustomerErrors = { name?: string; phone?: string; address?: string; shop_name?: string }

function validateNewCustomerField(field: keyof NewCustomerForm, value: string): string | undefined {
  const v = value.trim()
  switch (field) {
    case 'name': {
      if (!v) return 'Name is required.'
      if (v.length < 3 || v.length > 100) return 'Name must be 3-100 characters.'
      if (/^\d+$/.test(v)) return 'Name cannot be purely numbers.'
      if (/^[^a-zA-Z0-9]+$/.test(v)) return 'Name must contain at least one letter or digit.'
      return undefined
    }
    case 'phone': {
      if (!v) return 'Phone is required.'
      if (/[^0-9+\-\s()]/.test(v)) return 'Phone must not contain letters.'
      const digits = v.replace(/[^0-9]/g, '')
      const ok =
        /^03\d{9}$/.test(digits) || /^923\d{9}$/.test(digits) ||
        /^3\d{9}$/.test(digits) || /^0[24-9]\d{8,9}$/.test(digits) ||
        /^92[24-9]\d{8,9}$/.test(digits)
      if (!ok) return 'Enter a valid Pakistani phone number (e.g. 03XXXXXXXXX).'
      return undefined
    }
    case 'address': {
      if (!v) return 'Address is required.'
      if (v.length < 5 || v.length > 250) return 'Address must be 5-250 characters.'
      if (/^\d+$/.test(v)) return 'Address cannot be purely numbers.'
      if (/^[^a-zA-Z0-9]+$/.test(v)) return 'Address must contain at least one letter or digit.'
      return undefined
    }
    case 'shop_name': {
      if (!v) return undefined
      if (v.length < 3 || v.length > 100) return 'Shop name must be 3-100 characters.'
      return undefined
    }
    default: return undefined
  }
}

export default function CustomerLedgerPage() {
  const [data, setData] = useState<PaginatedResult<CustomerLedgerEntry> | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<InventoryItem[]>([])
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerLedgerEntry | null>(null)

  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [newCustomerForm, setNewCustomerForm] = useState<NewCustomerForm>({ name: '', phone: '', address: '', shop_name: '', obAmount: '0', obDirection: 'customer_owes_us' })
  const [newCustomerErrors, setNewCustomerErrors] = useState<NewCustomerErrors>({})
  const [newCustomerTouched, setNewCustomerTouched] = useState<Record<string, boolean>>({})

  const [transactionType, setTransactionType] = useState<'sale' | 'payment'>('sale')

  const [form, setForm] = useState({
    customer_id: '', transaction_datetime: '', total_payment: '',
    paid_amount: '', description: '', vehicle_number: '', due_date: '',
  })
  const [items, setItems] = useState<{ product_id: string; quantity: string; rate_per_unit: string }[]>([
    { product_id: '', quantity: '', rate_per_unit: '' }
  ])
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // @mention vendor state
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionCursor, setMentionCursor] = useState(0)
  const [taggedVendorId, setTaggedVendorId] = useState<string | null>(null)
  const [mentionRect, setMentionRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const descRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await api.customerLedger.list(
      filterCustomer || undefined, toISO(filterDateFrom) || undefined, toISO(filterDateTo) || undefined, page, 20
    )
    setData(result)
    setLoading(false)
  }, [filterCustomer, filterDateFrom, filterDateTo, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.customers.list(undefined, 1, 1000).then((r: PaginatedResult<Customer>) => setCustomers(r.data))
    api.inventory.list(undefined, 1, 1000).then((r: PaginatedResult<InventoryItem>) => setProducts(r.data))
    api.vendors.list(undefined, 1, 1000).then((r: any) => setVendors(r.data.map((v: any) => ({ id: v.id, name: v.name }))))
  }, [])

  const openCreate = () => {
    setEditing(null)
    setTransactionType('sale')
    setCustomerMode('existing')
    setNewCustomerForm({ name: '', phone: '', address: '', shop_name: '', obAmount: '0', obDirection: 'customer_owes_us' })
    setNewCustomerErrors({})
    setNewCustomerTouched({})
    setTaggedVendorId(null)
    setMentionOpen(false)
    setMentionFilter('')
    setMentionRect(null)
    setForm({ customer_id: '', transaction_datetime: localNow(), total_payment: '', paid_amount: '', description: '', vehicle_number: '', due_date: '' })
    setItems([{ product_id: '', quantity: '', rate_per_unit: '' }])
    setError('')
    setModalOpen(true)
  }

  const openEdit = async (entry: CustomerLedgerEntry) => {
    setEditing(entry)
    setTransactionType(entry.transaction_type as 'sale' | 'payment')
    setCustomerMode('existing')
    setNewCustomerForm({ name: '', phone: '', address: '', shop_name: '', obAmount: '0', obDirection: 'customer_owes_us' })
    setNewCustomerErrors({})
    setNewCustomerTouched({})
    setTaggedVendorId(null)
    setMentionOpen(false)
    setMentionFilter('')
    setMentionRect(null)

    let loadedItems = [{ product_id: '', quantity: '', rate_per_unit: '' }]
    let invoiceDueDate = ''
    if (entry.invoice_id) {
      try {
        const inv = await api.invoices.getWithItems(entry.invoice_id)
        if (inv) {
          invoiceDueDate = fmtDate(inv.due_date)
          if (inv.items && inv.items.length > 0) {
            loadedItems = inv.items.map((i: any) => ({
              product_id: i.product_id,
              quantity: String(i.quantity),
              rate_per_unit: String(i.rate_per_unit)
            }))
          }
        }
      } catch (err) {
        console.error('Failed to load invoice items', err)
      }
    }

    setForm({
      customer_id: entry.customer_id,
      transaction_datetime: fmtDatetime(entry.transaction_datetime.slice(0, 16)),
      total_payment: String(entry.total_payment), paid_amount: String(entry.paid_amount),
      description: entry.description || '', vehicle_number: entry.vehicle_number || '',
      due_date: invoiceDueDate
    })
    setItems(loadedItems)
    setError('')
    setModalOpen(true)
  }

  const addItemRow = () => setItems([...items, { product_id: '', quantity: '', rate_per_unit: '' }])
  const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index))
  const updateItemRow = (index: number, field: string, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const grandTotal = items.reduce((sum, it) => {
    const q = Number(it.quantity) || 0
    const r = Number(it.rate_per_unit) || 0
    return sum + (q * r)
  }, 0)

  useEffect(() => {
    if (!editing) {
      setForm(prev => ({ ...prev, total_payment: grandTotal > 0 ? String(grandTotal) : '' }))
    }
  }, [grandTotal, editing])

  const handleSubmit = async () => {
    if (customerMode === 'new' && !editing) {
      const ncErrors: NewCustomerErrors = {}
      for (const f of ['name', 'phone', 'address', 'shop_name'] as const) {
        const err = validateNewCustomerField(f, newCustomerForm[f])
        if (err) ncErrors[f] = err
      }
      setNewCustomerTouched({ name: true, phone: true, address: true, shop_name: true })
      setNewCustomerErrors(ncErrors)
      if (Object.keys(ncErrors).length > 0) { toast.error('Please fix customer field errors.'); return }
    }
    if (customerMode === 'existing' && !form.customer_id) { setError('Please select a customer'); return }
    if (!form.transaction_datetime) { setError('Date & Time is required'); return }

    if (transactionType === 'sale') {
      if (form.due_date) {
        const todayISO = new Date().toISOString().split('T')[0]
        const saleISO = toISO(form.transaction_datetime.split(' ')[0])
        const dueISO = toISO(form.due_date)
        if (dueISO < todayISO) {
          toast.error('Due date cannot be in the past')
          return
        }
        if (dueISO && saleISO && dueISO < saleISO) {
          toast.error('Due date cannot be earlier than the sale date')
          return
        }
      }

      const validItems = items.filter(it => it.product_id && Number(it.quantity) > 0 && Number(it.rate_per_unit) > 0)
      if (validItems.length === 0) { setError('At least one valid item row is required'); return }
      if (Number(form.paid_amount) > Number(form.total_payment)) { setError('Paid amount cannot exceed total payment'); return }
    } else if (transactionType === 'payment') {
      if (!form.paid_amount || Number(form.paid_amount) <= 0) { setError('Amount is required for payment'); return }
    }

    setError('')
    const isoDt = toISODatetime(form.transaction_datetime)
    const isoDueDate = toISO(form.due_date)
    const todayISO = new Date().toISOString().split('T')[0]

    if (isoDueDate) {
      if (isoDueDate < todayISO) {
        toast.error('Due date cannot be in the past')
        return
      }
      if (isoDt && isoDueDate < isoDt.split('T')[0]) {
        toast.error('Due date cannot be earlier than the sale date')
        return
      }
    }

    const validItems = items.filter(it => it.product_id && Number(it.quantity) > 0 && Number(it.rate_per_unit) > 0)
    const mappedItems = validItems.map(it => ({
      productId: it.product_id,
      quantity: Number(it.quantity),
      ratePerUnit: Number(it.rate_per_unit)
    }))

    try {
      let result: any
      const customerId = form.customer_id

      if (editing) {
        result = await api.customerLedger.updateMultiItem(editing.id, customerId, {
          items: mappedItems,
          transactionDatetime: isoDt,
          totalPayment: Number(form.total_payment),
          paidAmount: Number(form.paid_amount),
          description: form.description || undefined,
          vehicleNumber: form.vehicle_number || undefined,
          dueDate: isoDueDate || undefined
        })
      } else if (transactionType === 'payment') {
        result = await api.customerLedger.create(
          customerId, isoDt, [],
          Number(form.total_payment), Number(form.paid_amount),
          form.description || undefined, undefined, undefined, 'payment',
          taggedVendorId || undefined
        )
      } else if (customerMode === 'new') {
        const obAmount = Number(newCustomerForm.obAmount) || 0
        const openingBalance = newCustomerForm.obDirection === 'customer_owes_us' ? obAmount : -obAmount
        result = await api.customerLedger.createMultiItem(
          { name: newCustomerForm.name, phone: newCustomerForm.phone, address: newCustomerForm.address, shop_name: newCustomerForm.shop_name || undefined, opening_balance: openingBalance },
          { items: mappedItems, transactionDatetime: isoDt, totalPayment: Number(form.total_payment), paidAmount: Number(form.paid_amount), description: form.description || undefined, vehicleNumber: form.vehicle_number || undefined, dueDate: isoDueDate || undefined }
        )
      } else {
        result = await api.customerLedger.create(
          customerId, isoDt, mappedItems,
          Number(form.total_payment), Number(form.paid_amount),
          form.description || undefined, form.vehicle_number || undefined, isoDueDate, 'sale'
        )
      }

      if (result && typeof result === 'object' && 'error' in result) {
        toast.error(result.error as string);
        return;
      }

      if (customerMode === 'new' && !editing) {
        api.customers.list(undefined, 1, 1000).then((r: PaginatedResult<Customer>) => setCustomers(r.data));
      }

      setModalOpen(false)
      load()
      toast.success(editing ? 'Entry updated successfully' : `${transactionType === 'payment' ? 'Payment' : 'Sale'} created successfully`)
    } catch {
      toast.error('Failed to save entry')
    }
  }

  const handleDelete = (entry: CustomerLedgerEntry) => {
    setDeletingId(entry.id)
  }

  const remainingBalance = Number(form.total_payment) - Number(form.paid_amount)

  // @mention handlers
  const filteredVendors = mentionFilter
    ? vendors.filter(v => v.name.toLowerCase().includes(mentionFilter.toLowerCase()))
    : vendors

  const handleDescChange = (val: string) => {
    setForm(f => ({ ...f, description: val }))
    const atIndex = val.lastIndexOf('@')
    if (atIndex >= 0) {
      const afterAt = val.slice(atIndex + 1)
      if (!afterAt.includes(' ')) {
        setMentionOpen(true)
        setMentionFilter(afterAt)
        setMentionCursor(0)
        if (descRef.current) {
          const r = descRef.current.getBoundingClientRect()
          setMentionRect({ top: r.bottom, left: r.left, width: r.width })
        }
      } else {
        setMentionOpen(false)
        setMentionRect(null)
      }
    } else {
      setMentionOpen(false)
      setMentionRect(null)
      setTaggedVendorId(null)
    }
  }

  const selectVendor = (vendor: { id: string; name: string }) => {
    const val = form.description
    const atIndex = val.lastIndexOf('@')
    const before = val.slice(0, atIndex)
    setForm(f => ({ ...f, description: before + '@' + vendor.name + ' ' }))
    setTaggedVendorId(vendor.id)
    setMentionOpen(false)
    setMentionRect(null)
    descRef.current?.focus()
  }

  const columns = [
    { key: 'transaction_datetime', label: 'Date', render: (e: CustomerLedgerEntry) => new Date(e.transaction_datetime).toLocaleDateString() },
    { key: 'customer_name', label: 'Customer' },
    { key: 'transaction_type', label: 'Type', render: (e: CustomerLedgerEntry) => (
      <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (e.transaction_type === 'payment' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400')}>
        {e.transaction_type === 'payment' ? 'Payment' : 'Sale'}
      </span>
    )},
    { key: 'product_name', label: 'Product(s)', render: (e: CustomerLedgerEntry) => e.transaction_type === 'payment' ? '-' : (e.product_name || '-') },
    { key: 'description', label: 'Desc' },
    { key: 'vehicle_number', label: 'Vehicle', render: (e: CustomerLedgerEntry) => e.transaction_type === 'payment' ? '-' : (e.vehicle_number || '-') },
    { key: 'quantity', label: 'Total Qty', render: (e: CustomerLedgerEntry) => e.transaction_type === 'payment' ? '-' : (e.quantity ?? '-') },
    { key: 'rate_per_unit', label: 'Avg Rate', render: (e: CustomerLedgerEntry) => e.transaction_type === 'payment' ? '-' : `Rs. ${e.rate_per_unit?.toFixed(2) || '0'}` },
    { key: 'total_payment', label: 'Total', render: (e: CustomerLedgerEntry) => `Rs. ${e.total_payment.toLocaleString()}` },
    { key: 'paid_amount', label: 'Paid', render: (e: CustomerLedgerEntry) => `Rs. ${e.paid_amount.toLocaleString()}` },
    {
      key: 'remaining_balance', label: 'Remaining Balance',
      render: (e: CustomerLedgerEntry) => {
        const rb = e.running_balance!
        return (
          <span className={rb < 0 ? 'text-red-600' : rb > 0 ? 'text-green-600' : 'text-gray-500'}>
            Rs. {rb.toLocaleString()}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Customer Ledger</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-[#6B7280] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          New Entry
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1">Customer</label>
          <select value={filterCustomer} onChange={(e) => { setFilterCustomer(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
            <option value="">All Customers</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.shop_name ? ` (${c.shop_name})` : ''}</option>)}
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
        {(filterCustomer || filterDateFrom || filterDateTo) && (
          <button onClick={() => { setFilterCustomer(''); setFilterDateFrom(''); setFilterDateTo(''); setPage(1) }}
            className="px-3 py-2 text-sm rounded-xl border border-[#D1D5DB] dark:border-white/[0.1] text-brand-text-muted hover:bg-gray-50 dark:hover:bg-white/[0.08]">
            Clear
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-brand-card dark:bg-white/[0.04] border-brand-border dark:border-white/[0.06] overflow-hidden">
        <DataTable columns={columns} data={data?.data ?? []} onEdit={openEdit} onDelete={handleDelete} loading={loading} />
        {data && <Pagination page={data.page} total={data.total} limit={20} onChange={setPage} />}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Entry' : 'New Entry'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Transaction type toggle (only for new entries) */}
          {!editing && (
            <div className="flex rounded-xl border border-gray-200 dark:border-white/[0.1] overflow-hidden">
              <button type="button" onClick={() => setTransactionType('sale')}
                className={'flex-1 py-2 text-sm font-medium transition-colors ' + (transactionType === 'sale' ? 'bg-[#6B7280] text-white' : 'bg-gray-50 dark:bg-white/[0.04] text-brand-text-muted dark:text-gray-400')}>
                Sale
              </button>
              <button type="button" onClick={() => setTransactionType('payment')}
                className={'flex-1 py-2 text-sm font-medium transition-colors ' + (transactionType === 'payment' ? 'bg-[#6B7280] text-white' : 'bg-gray-50 dark:bg-white/[0.04] text-brand-text-muted dark:text-gray-400')}>
                Payment
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-brand-text-primary dark:text-white">Customer *</label>
              {!editing && (
                <button type="button" onClick={() => {
                  setCustomerMode(m => m === 'existing' ? 'new' : 'existing')
                  setNewCustomerErrors({})
                  setNewCustomerTouched({})
                  setNewCustomerForm({ name: '', phone: '', address: '', shop_name: '', obAmount: '0', obDirection: 'customer_owes_us' })
                }} className="text-xs font-medium text-gray-900 dark:text-white hover:underline">
                  {customerMode === 'existing' ? '+ Add New Customer' : '\u2190 Existing Customer'}
                </button>
              )}
            </div>
            {customerMode === 'existing' || editing ? (
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                <option value="">Select Customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.shop_name ? ` (${c.shop_name})` : ''}</option>)}
              </select>
            ) : (
              <div className="space-y-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">New customer details \u2014 will be saved when you submit</p>
                {(['name', 'phone', 'address', 'shop_name'] as const).map(field => (
                  <div key={field}>
                    <input
                      type={field === 'phone' ? 'tel' : 'text'}
                      value={newCustomerForm[field]}
                      placeholder={field === 'name' ? 'Customer Name *' : field === 'phone' ? 'Phone Number *' : field === 'address' ? 'Address *' : 'Shop Name (optional)'}
                      inputMode={field === 'phone' ? 'numeric' : undefined}
                      onChange={e => {
                        const val = e.target.value
                        setNewCustomerForm(prev => ({ ...prev, [field]: val }))
                        if (newCustomerTouched[field]) setNewCustomerErrors(prev => ({ ...prev, [field]: validateNewCustomerField(field, val) ?? '' }))
                      }}
                      onBlur={() => {
                        setNewCustomerTouched(prev => ({ ...prev, [field]: true }))
                        setNewCustomerErrors(prev => ({ ...prev, [field]: validateNewCustomerField(field, newCustomerForm[field]) ?? '' }))
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                    />
                    {newCustomerTouched[field] && newCustomerErrors[field] && <p className="text-xs text-red-500 mt-1">{newCustomerErrors[field]}</p>}
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-brand-text-primary dark:text-white mb-1">Opening Balance</label>
                  <div className="flex gap-2 items-center">
                    <select value={newCustomerForm.obDirection} onChange={e => setNewCustomerForm(prev => ({ ...prev, obDirection: e.target.value as 'customer_owes_us' | 'we_owe_customer' }))}
                      className="px-2 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                      <option value="customer_owes_us">Customer owes us</option>
                      <option value="we_owe_customer">We owe customer</option>
                    </select>
                    <input type="number" value={newCustomerForm.obAmount} placeholder="0"
                      onChange={e => setNewCustomerForm(prev => ({ ...prev, obAmount: e.target.value }))}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-28 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 no-spinner" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {transactionType === 'sale' && (
            <div className="space-y-4 bg-gray-50/50 dark:bg-white/[0.02] p-4 rounded-xl border border-gray-100 dark:border-white/[0.05]">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-brand-text-primary dark:text-white">Sale Items</h3>
                <button type="button" onClick={addItemRow} className="text-xs font-medium text-gray-900 dark:text-white hover:underline">
                  + Add Item
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="relative grid grid-cols-12 gap-3 items-end bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItemRow(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200">
                      \u00d7
                    </button>
                  )}
                  <div className="col-span-5">
                    <label className="block text-xs font-medium text-brand-text-primary dark:text-gray-300 mb-1">Product *</label>
                    <select value={item.product_id} onChange={(e) => updateItemRow(idx, 'product_id', e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                      <option value="">Select Product</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-brand-text-primary dark:text-gray-300 mb-1">Qty * {(() => { const p = products.find(p => p.id === item.product_id); return p?.unit ? <span className="text-brand-text-muted font-normal">({p.unit})</span> : null })()}</label>
                    <input type="number" value={item.quantity} placeholder="0"
                      onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()} onFocus={(e) => e.target.select()}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white no-spinner" />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-brand-text-primary dark:text-gray-300 mb-1">Rate *</label>
                    <input type="number" value={item.rate_per_unit} placeholder="0"
                      onChange={(e) => updateItemRow(idx, 'rate_per_unit', e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()} onFocus={(e) => e.target.select()}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white no-spinner" />
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
                  Grand Total: Rs. {grandTotal.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {transactionType === 'payment' ? (
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Amount *</label>
              <input type="number" value={form.paid_amount} placeholder="0" onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} onWheel={(e) => e.currentTarget.blur()} onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 no-spinner" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Total Payment *</label>
                <input type="number" value={form.total_payment} placeholder="0" onChange={(e) => setForm({ ...form, total_payment: e.target.value })} onWheel={(e) => e.currentTarget.blur()} onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 no-spinner" />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Paid Amount *</label>
                <input type="number" value={form.paid_amount} placeholder="0" onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} onWheel={(e) => e.currentTarget.blur()} onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 no-spinner" />
              </div>
              {remainingBalance >= 0 && (
                <p className="text-sm text-brand-text-muted">Remaining balance: <strong className={remainingBalance === 0 ? 'text-green-600' : 'text-orange-600'}>Rs. {remainingBalance.toLocaleString()}</strong></p>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">{transactionType === 'payment' ? 'Payment' : 'Sale'} Date *</label>
            <DateTimeInput value={form.transaction_datetime} onChange={(v) => setForm({ ...form, transaction_datetime: v })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>

          {transactionType === 'sale' && (
            <>
              <div>
                <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Due Date <span className="text-brand-text-muted font-normal text-xs">(optional \u2014 leave blank if not on credit)</span></label>
                <DateInput value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
                {form.due_date && form.transaction_datetime && toISO(form.due_date) < toISO(form.transaction_datetime.split(' ')[0]) && (
                  <p className="text-xs text-red-500 mt-1">Due date cannot be earlier than the sale date</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              </div>
            </>
          )}

          {transactionType === 'payment' && (
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Description <span className="text-brand-text-muted font-normal text-xs">(type @ to mention a vendor)</span></label>
              <input ref={descRef} type="text" value={form.description} onChange={(e) => handleDescChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
              {mentionOpen && filteredVendors.length > 0 && mentionRect && createPortal(
                <div style={{ position: 'fixed', top: mentionRect.top, left: mentionRect.left, width: mentionRect.width, zIndex: 9999 }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredVendors.map((v, i) => (
                    <button key={v.id} type="button" onClick={() => selectVendor(v)}
                      className={'w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 ' + (i === mentionCursor ? 'bg-gray-100 dark:bg-gray-700' : '')}>
                      {v.name}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-[#D1D5DB] dark:border-white/[0.1] text-brand-text-muted hover:bg-gray-50 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 text-sm rounded-xl bg-[#6B7280] text-white font-medium hover:opacity-90">{transactionType === 'payment' ? 'Record Payment' : 'Save'}</button>
          </div>
        </div>
      </Modal>
      <ConfirmModal open={deletingId !== null} onClose={() => setDeletingId(null)}
        onConfirm={async () => { if (deletingId) { try { await api.customerLedger.delete(deletingId); toast.success('Entry deleted successfully') } catch { toast.error('Failed to delete entry') } setDeletingId(null); load() } }}
        title="Delete Entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        confirmLabel="Delete" danger />
    </div>
  )
}
