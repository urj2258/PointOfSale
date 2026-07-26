import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../services/api'
import type { Vendor, InventoryItem, VendorLedgerEntry } from '../../types'
import Modal from '../ui/Modal'
import DateInput from '../ui/DateInput'
import DateTimeInput from '../ui/DateTimeInput'
import toast from 'react-hot-toast'

const fmtDate = (d: string) => {
  if (!d) return ''
  const parts = d.split('T')[0].split('-')
  if (parts.length !== 3) return d
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}
const toISO = (d: string) => {
  if (!d) return ''
  const parts = d.split('/')
  if (parts.length !== 3) return d
  const dd = parts[0].trim(); const mm = parts[1].trim(); const yyyy = parts[2].trim()
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return d
  return yyyy + '-' + mm + '-' + dd
}
function localNow(): string {
  const n = new Date()
  const dd = String(n.getDate()).padStart(2, '0')
  const mm = String(n.getMonth() + 1).padStart(2, '0')
  const yyyy = n.getFullYear()
  const hh = String(n.getHours()).padStart(2, '0')
  const mi = String(n.getMinutes()).padStart(2, '0')
  return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + mi
}
const fmtDatetime = (dt: string) => {
  if (!dt) return ''
  const [datePart, timePart] = dt.split('T')
  const [y, m, d] = datePart.split('-')
  return d + '/' + m + '/' + y + ' ' + (timePart || '')
}
const toISODatetime = (dt: string) => {
  if (!dt) return ''
  const [datePart, timePart] = dt.split(' ')
  const parts = datePart.split('/')
  if (parts.length !== 3) return dt
  const dd = parts[0].trim(); const mm = parts[1].trim(); const yyyy = parts[2].trim()
  return yyyy + '-' + mm + '-' + dd + 'T' + (timePart || '00:00')
}

export default function VendorPurchaseModal({ open, onClose, onSuccess, lockedVendorId, editEntry }: {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  lockedVendorId?: string
  editEntry?: VendorLedgerEntry
}) {
  // Only load vendors/products when not locked (for existing vendor dropdown)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<InventoryItem[]>([])

  const [vendorMode, setVendorMode] = useState<'existing' | 'new'>('existing')
  const [newVendorForm, setNewVendorForm] = useState({ name: '', phone: '', address: '', mill_name: '', obAmount: '0', obDirection: 'mill_owes_us' as 'mill_owes_us' | 'we_owe_mill' })
  const [newVendorErrors, setNewVendorErrors] = useState<Record<string, string>>({})
  const [newVendorTouched, setNewVendorTouched] = useState<Record<string, boolean>>({})

  const [transactionType, setTransactionType] = useState<'purchase' | 'payment'>('purchase')
  const [form, setForm] = useState({
    vendor_id: '', transaction_datetime: '',
    total_payment: '', paid_amount: '', description: '', vehicle_number: '', due_date: '',
  })
  const [items, setItems] = useState([{ product_id: '', quantity: '', rate_per_unit: '' }])
  const [error, setError] = useState('')

  // Customer @mention state
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionCursor, setMentionCursor] = useState(0)
  const [taggedCustomerId, setTaggedCustomerId] = useState<string | null>(null)
  const [mentionRect, setMentionRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const descRef = useRef<HTMLInputElement>(null)

  // Reset state every time the modal opens
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setPrevOpen(true)
    setTaggedCustomerId(null)
    setMentionOpen(false)
    setMentionFilter('')
    setMentionRect(null)
    if (editEntry) {
      setTransactionType(editEntry.transaction_type as 'purchase' | 'payment')
      setVendorMode('existing')
      setNewVendorForm({ name: '', phone: '', address: '', mill_name: '', obAmount: '0', obDirection: 'mill_owes_us' })
      setNewVendorErrors({})
      setNewVendorTouched({})
      const rawDueDate = editEntry.invoice_due_date || ''
      setForm({
        vendor_id: lockedVendorId || editEntry.vendor_id,
        transaction_datetime: fmtDatetime(editEntry.transaction_datetime.slice(0, 16)),
        total_payment: String(editEntry.total_payment), paid_amount: String(editEntry.paid_amount),
        description: editEntry.description || '', vehicle_number: editEntry.vehicle_number || '',
        due_date: rawDueDate ? fmtDate(rawDueDate) : '',
      })
      setItems([{ product_id: editEntry.product_id, quantity: String(editEntry.quantity), rate_per_unit: String(editEntry.rate_per_unit) }])
      setError('')
    } else {
      setTransactionType('purchase')
      setVendorMode('existing')
      setNewVendorForm({ name: '', phone: '', address: '', mill_name: '', obAmount: '0', obDirection: 'mill_owes_us' })
      setNewVendorErrors({})
      setNewVendorTouched({})
      setItems([{ product_id: '', quantity: '', rate_per_unit: '' }])
      setForm({
        vendor_id: lockedVendorId || '',
        transaction_datetime: localNow(),
        total_payment: '', paid_amount: '', description: '', vehicle_number: '', due_date: '',
      })
      setError('')
    }
  }
  if (!open && prevOpen) {
    setPrevOpen(false)
  }

  // Load lookups
  const needsLookups = open && !lockedVendorId
  if (open && vendors.length === 0 && needsLookups) {
    api.vendors.list(undefined, 1, 1000).then((r: any) => setVendors(r.data))
  }
  if (open && products.length === 0) {
    api.inventory.list(undefined, 1, 1000).then((r: any) => setProducts(r.data))
  }
  if (open && customers.length === 0) {
    api.customers.list(undefined, 1, 1000).then((r: any) => setCustomers(r.data.map((c: any) => ({ id: c.id, name: c.name }))))
  }

  // Load invoice items when editing a purchase entry with an invoice
  useEffect(() => {
    if (open && editEntry && editEntry.transaction_type === 'purchase' && editEntry.vendor_invoice_id) {
      api.vendorInvoices.getWithItems(editEntry.vendor_invoice_id).then((invoice: any) => {
        const invoiceItems = invoice?.items ?? []
        if (invoiceItems.length > 0) {
          setItems(invoiceItems.map((it: any) => ({
            product_id: it.product_id,
            quantity: String(it.quantity),
            rate_per_unit: String(it.rate_per_unit),
          })))
        } else {
          setItems([{ product_id: editEntry.product_id, quantity: String(editEntry.quantity), rate_per_unit: String(editEntry.rate_per_unit) }])
        }
      }).catch(() => {
        setItems([{ product_id: editEntry.product_id, quantity: String(editEntry.quantity), rate_per_unit: String(editEntry.rate_per_unit) }])
      })
    }
  }, [open, editEntry])

  const remainingBalance = Number(form.total_payment) - Number(form.paid_amount)

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
    // Vendor validation
    if (lockedVendorId) {
      // already set
    } else if (vendorMode === 'new') {
      const nvErrors: Record<string, string> = {}
      for (const f of ['name', 'phone', 'address', 'mill_name']) {
        const err = validateNewVendorField(f, newVendorForm[f as keyof typeof newVendorForm])
        if (err) nvErrors[f] = err
      }
      setNewVendorTouched({ name: true, phone: true, address: true, mill_name: true })
      setNewVendorErrors(nvErrors)
      if (Object.keys(nvErrors).length > 0) { toast.error('Please fix vendor field errors.'); return }
    } else if (!form.vendor_id) {
      toast.error('Please select a vendor.')
      return
    }

    if (!form.transaction_datetime) { toast.error('Fill required fields'); return }

    if (transactionType === 'purchase') {
      if (form.due_date) {
        const todayISO = new Date().toISOString().split('T')[0]
        const purchaseISO = toISO(form.transaction_datetime.split(' ')[0])
        const dueISO = toISO(form.due_date)
        if (dueISO < todayISO) {
          toast.error('Due date cannot be in the past')
          return
        }
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
    } else if (transactionType === 'payment') {
      if (!form.paid_amount || Number(form.paid_amount) <= 0) { toast.error('Amount is required for payment'); return }
    }

    setError('')
    const isoDt = toISODatetime(form.transaction_datetime)
    const isoDueDate = form.due_date ? toISO(form.due_date) : undefined
    const formattedItems = items.map(it => ({
      productId: it.product_id,
      quantity: Number(it.quantity),
      ratePerUnit: Number(it.rate_per_unit)
    }))
    try {
      const vendorId = lockedVendorId || form.vendor_id

      if (editEntry) {
        if (transactionType === 'payment') {
          toast.error('Payment entries cannot be edited')
          return
        }
        await api.vendorLedger.update(editEntry.id, vendorId, isoDt, formattedItems,
          Number(form.total_payment), Number(form.paid_amount),
          form.description || undefined, form.vehicle_number || undefined, isoDueDate)
      } else if (transactionType === 'payment') {
        await api.vendorLedger.create(
          vendorId, isoDt, [],
          Number(form.total_payment), Number(form.paid_amount),
          form.description || undefined, undefined, undefined, 'payment',
          taggedCustomerId || undefined
        )
      } else if (vendorMode === 'new') {
        const obAmount = Number(newVendorForm.obAmount) || 0
        const openingBalance = newVendorForm.obDirection === 'mill_owes_us' ? obAmount : -obAmount
        const result = await api.vendorLedger.createWithNewVendor(
          { name: newVendorForm.name, phone: newVendorForm.phone, address: newVendorForm.address, mill_name: newVendorForm.mill_name || undefined, opening_balance: openingBalance },
          { items: formattedItems, transactionDatetime: isoDt, totalPayment: Number(form.total_payment), paidAmount: Number(form.paid_amount), description: form.description || undefined, vehicleNumber: form.vehicle_number || undefined, dueDate: isoDueDate }
        )
        if ((result as any)?.error) { toast.error((result as any).error); return }
        api.vendors.list(undefined, 1, 1000).then((r: any) => setVendors(r.data))
      } else {
        await api.vendorLedger.create(
          vendorId, isoDt, formattedItems,
          Number(form.total_payment), Number(form.paid_amount),
          form.description || undefined, form.vehicle_number || undefined, isoDueDate, 'purchase'
        )
      }
      onClose()
      onSuccess?.()
      toast.success(editEntry ? 'Entry updated successfully' : (transactionType === 'payment' ? 'Payment entry created successfully' : 'Purchase entry created successfully'))
    } catch {
      toast.error('Failed to save entry')
    }
  }

  const filteredCustomers = mentionFilter
    ? customers.filter(c => c.name.toLowerCase().includes(mentionFilter.toLowerCase()))
    : customers

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
      setTaggedCustomerId(null)
    }
  }

  const selectCustomer = (customer: { id: string; name: string }) => {
    const val = form.description
    const atIndex = val.lastIndexOf('@')
    const before = val.slice(0, atIndex)
    setForm(f => ({ ...f, description: before + '@' + customer.name + ' ' }))
    setTaggedCustomerId(customer.id)
    setMentionOpen(false)
    setMentionRect(null)
    descRef.current?.focus()
  }

  return (
    <Modal open={open} onClose={onClose} title={editEntry ? (transactionType === 'payment' ? 'Edit Payment' : 'Edit Purchase') : (transactionType === 'payment' ? 'New Payment' : 'New Purchase')}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Transaction type toggle (disabled when editing) */}
        {!editEntry ? (
          <div className="flex rounded-xl border border-gray-200 dark:border-white/[0.1] overflow-hidden">
            <button type="button" onClick={() => setTransactionType('purchase')}
              className={'flex-1 py-2 text-sm font-medium transition-colors ' + (transactionType === 'purchase' ? 'bg-[#6B7280] text-white' : 'bg-gray-50 dark:bg-white/[0.04] text-brand-text-muted dark:text-gray-400')}>
              Purchase
            </button>
            <button type="button" onClick={() => setTransactionType('payment')}
              className={'flex-1 py-2 text-sm font-medium transition-colors ' + (transactionType === 'payment' ? 'bg-[#6B7280] text-white' : 'bg-gray-50 dark:bg-white/[0.04] text-brand-text-muted dark:text-gray-400')}>
              Payment
            </button>
          </div>
        ) : (
          <div className="flex rounded-xl border border-gray-200 dark:border-white/[0.1] overflow-hidden">
            <div className={'flex-1 py-2 text-sm font-medium text-center ' + (transactionType === 'purchase' ? 'bg-[#6B7280] text-white' : 'bg-gray-50 dark:bg-white/[0.04] text-brand-text-muted dark:text-gray-400')}>
              {transactionType === 'payment' ? 'Payment' : 'Purchase'}
            </div>
          </div>
        )}

        {!lockedVendorId && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-brand-text-primary dark:text-white">Vendor *</label>
              <button
                type="button"
                onClick={() => {
                  setVendorMode(v => v === 'existing' ? 'new' : 'existing')
                  setNewVendorErrors({})
                  setNewVendorTouched({})
                  setNewVendorForm({ name: '', phone: '', address: '', mill_name: '', obAmount: '0', obDirection: 'mill_owes_us' })
                }}
                className="text-xs font-medium text-gray-900 dark:text-white hover:underline"
              >
                {vendorMode === 'existing' ? '+ Add New Vendor' : '\u2190 Existing Vendor'}
              </button>
            </div>

            {vendorMode === 'existing' ? (
              <select value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                <option value="">Select Vendor</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.mill_name ? ` (${v.mill_name})` : ''}</option>)}
              </select>
            ) : (
              <div className="space-y-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">New vendor details \u2014 will be saved when you submit</p>
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
                <div>
                  <label className="block text-xs font-medium text-brand-text-primary dark:text-white mb-1">Opening Balance</label>
                  <div className="flex gap-2 items-center">
                    <select value={newVendorForm.obDirection} onChange={e => setNewVendorForm(prev => ({ ...prev, obDirection: e.target.value as 'mill_owes_us' | 'we_owe_mill' }))}
                      className="px-2 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                      <option value="mill_owes_us">Mill owes us</option>
                      <option value="we_owe_mill">We owe mill</option>
                    </select>
                    <input type="number" value={newVendorForm.obAmount} placeholder="0"
                      onChange={e => { const val = e.target.value; setNewVendorForm(prev => ({ ...prev, obAmount: val })) }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-28 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 no-spinner" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {transactionType === 'purchase' && (
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
                    &times;
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
                  <label className="block text-xs font-medium text-brand-text-primary dark:text-gray-300 mb-1">Qty * {(() => { const p = products.find(p => p.id === item.product_id); return p?.unit ? <span className="text-brand-text-muted font-normal">({p.unit})</span> : null })()}</label>
                  <input type="number" value={item.quantity} placeholder="0"
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].quantity = e.target.value;
                      setItems(newItems);
                      const gt = newItems.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate_per_unit)), 0);
                      setForm(f => ({ ...f, total_payment: String(gt) }));
                    }}
                    onWheel={(e) => e.currentTarget.blur()} onFocus={(e) => e.target.select()}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white no-spinner" />
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
                Grand Total: Rs. {items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate_per_unit)), 0).toLocaleString()}
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
          <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">{transactionType === 'payment' ? 'Payment' : 'Purchase'} Date *</label>
          <DateTimeInput value={form.transaction_datetime} onChange={(v) => setForm({ ...form, transaction_datetime: v })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
        </div>

        {transactionType === 'purchase' && (
          <>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Payment Due Date <span className="text-brand-text-muted font-normal text-xs">(optional - leave blank if not on credit)</span></label>
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
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Description {transactionType === 'payment' && <span className="text-brand-text-muted font-normal text-xs">(type @ to mention a customer)</span>}</label>
          <input ref={descRef} type="text" value={form.description} onChange={(e) => handleDescChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          {mentionOpen && filteredCustomers.length > 0 && mentionRect && createPortal(
            <div style={{ position: 'fixed', top: mentionRect.top, left: mentionRect.left, width: mentionRect.width, zIndex: 9999 }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
              {filteredCustomers.map((c, i) => (
                <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                  className={'w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 ' + (i === mentionCursor ? 'bg-gray-100 dark:bg-gray-700' : '')}>
                  {c.name}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-[#D1D5DB] dark:border-white/[0.1] text-brand-text-muted hover:bg-gray-50 dark:hover:bg-white/[0.08]">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm rounded-xl bg-[#6B7280] text-white font-medium hover:opacity-90">{transactionType === 'payment' ? 'Record Payment' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  )
}
