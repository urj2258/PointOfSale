import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import type { InventoryItem, Vendor, VendorInvoice, VendorLedgerEntry, PaginatedResult } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import toast from 'react-hot-toast'
import DateInput from '../../components/ui/DateInput'

interface ItemLine {
  productId: string
  productName: string
  quantity: number
  ratePerUnit: number
  ledgerEntryId?: string
}

const emptyForm = {
  vendor_id: '',
  invoice_number: '',
  issue_date: new Date().toLocaleDateString('en-GB'),
  due_date: '',
  subtotal: 0,
  tax_amount: 0,
  discount_amount: 0,
  total: 0,
  paid_amount: 0,
  notes: '',
  items: [] as ItemLine[],
}

export default function VendorInvoicesPage() {
  const [data, setData] = useState<PaginatedResult<VendorInvoice> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VendorInvoice | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [invoiceItems, setInvoiceItems] = useState<Record<string, { product_name: string; quantity: number; rate_per_unit: number }[]>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingEntries, setPendingEntries] = useState<VendorLedgerEntry[]>([])
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([])



  useEffect(() => {
    api.vendors.list(undefined, 1, 999).then((r: PaginatedResult<Vendor>) => setVendors(r.data)).catch(() => {})
    api.inventory.list(undefined, 1, 999).then((r: PaginatedResult<InventoryItem>) => setInventory(r.data)).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.vendorInvoices.list(statusFilter || undefined, undefined, undefined, undefined, page, 50)
      const itemsMap: Record<string, { product_name: string; quantity: number; rate_per_unit: number }[]> = {}
      await Promise.all(result.data.map(async (inv) => {
        try {
          const withItems = await api.vendorInvoices.getWithItems(inv.id) as any
          itemsMap[inv.id] = (withItems.items || []).map((i: any) => ({
            product_name: i.product_name || 'Unknown',
            quantity: i.quantity,
            rate_per_unit: i.rate_per_unit,
          }))
        } catch {
          itemsMap[inv.id] = []
        }
      }))
      setInvoiceItems(itemsMap)
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!editing && form.vendor_id) {
      api.vendorLedger.pending(form.vendor_id).then((entries: VendorLedgerEntry[]) => setPendingEntries(entries)).catch(() => setPendingEntries([]))
    } else {
      setPendingEntries([])
    }
    setSelectedEntryIds([])
  }, [form.vendor_id, editing])

  const handleToggleEntry = (entry: VendorLedgerEntry) => {
    const idx = selectedEntryIds.indexOf(entry.id)
    let nextIds: string[]
    let nextItems: ItemLine[]
    if (idx >= 0) {
      nextIds = selectedEntryIds.filter(id => id !== entry.id)
      nextItems = form.items.filter(item => item.ledgerEntryId !== entry.id)
    } else {
      nextIds = [...selectedEntryIds, entry.id]
      nextItems = [...form.items, {
        productId: entry.product_id,
        productName: entry.product_name || '',
        quantity: entry.quantity,
        ratePerUnit: entry.rate_per_unit,
        ledgerEntryId: entry.id,
      }]
    }
    setSelectedEntryIds(nextIds)
    setForm(recalc({ ...form, items: nextItems }))
  }

  const recalc = (f: typeof form) => {
    const subtotal = f.items.reduce((s, i) => s + i.quantity * i.ratePerUnit, 0)
    const total = subtotal - f.discount_amount
    return { ...f, subtotal, total: Math.max(0, total) }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, invoice_number: `VINV-${Date.now()}` })
    setError('')
    setPendingEntries([])
    setSelectedEntryIds([])
    setModalOpen(true)
  }

  const openEdit = async (inv: VendorInvoice) => {
    setEditing(inv)
    try {
      const withItems = await api.vendorInvoices.getWithItems(inv.id) as VendorInvoice & { items: { product_id: string; product_name: string; quantity: number; rate_per_unit: number }[] }
      const items: ItemLine[] = (withItems as any).items?.map((i: any) => ({
        productId: i.product_id,
        productName: i.product_name || '',
        quantity: i.quantity,
        ratePerUnit: i.rate_per_unit,
      })) || []
      setForm({
        vendor_id: inv.vendor_id,
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date ? fmtIsoDate(inv.issue_date) : '',
        due_date: inv.due_date ? fmtIsoDate(inv.due_date) : '',
        subtotal: inv.subtotal,
        tax_amount: inv.tax_amount,
        discount_amount: inv.discount_amount,
        total: inv.total,
        paid_amount: inv.paid_amount,
        notes: inv.notes || '',
        items,
      })
    } catch {
      setForm({
        vendor_id: inv.vendor_id,
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date ? fmtIsoDate(inv.issue_date) : '',
        due_date: inv.due_date ? fmtIsoDate(inv.due_date) : '',
        subtotal: inv.subtotal,
        tax_amount: inv.tax_amount,
        discount_amount: inv.discount_amount,
        total: inv.total,
        paid_amount: inv.paid_amount,
        notes: inv.notes || '',
        items: [],
      })
    }
    setError('')
    setModalOpen(true)
  }

  const addItemLine = () => {
    setForm(recalc({ ...form, items: [...form.items, { productId: '', productName: '', quantity: 1, ratePerUnit: 0 }] }))
  }

  const handleItemProduct = (idx: number, productId: string) => {
    const product = inventory.find(p => p.id === productId)
    const items = [...form.items]
    items[idx] = { ...items[idx], productId, productName: product?.name ?? '' }
    setForm(recalc({ ...form, items }))
  }

  const updateItemLine = (idx: number, field: keyof ItemLine, value: string | number) => {
    const items = [...form.items]
    items[idx] = { ...items[idx], [field]: value }
    setForm(recalc({ ...form, items }))
  }

  const removeItemLine = (idx: number) => {
    setForm(recalc({ ...form, items: form.items.filter((_, i) => i !== idx) }))
  }

  const handleSubmit = async () => {
    if (!form.vendor_id || !form.invoice_number || !form.issue_date || !form.due_date) {
      setError('Vendor, invoice number, issue date, and due date are required'); return
    }
    if (form.items.length === 0) { setError('At least one item is required'); return }
    setError('')
    const items = form.items.map(i => ({ productId: i.productId, quantity: i.quantity, ratePerUnit: i.ratePerUnit }))
    const isoIssue = toISO(form.issue_date)
    const isoDue = toISO(form.due_date)
    try {
      if (editing) {
        await api.vendorInvoices.update(editing.id, form.vendor_id, form.invoice_number, isoIssue, isoDue,
          form.subtotal, form.tax_amount, form.discount_amount, form.total, form.paid_amount, editing.status, form.notes || undefined)
        await api.vendorInvoices.replaceItems(editing.id, items)
      } else {
        const newInv = await api.vendorInvoices.create(form.vendor_id, form.invoice_number, isoIssue, isoDue,
          form.subtotal, form.tax_amount, form.discount_amount, form.total, form.paid_amount,
          form.notes || undefined, items) as VendorInvoice
        if (selectedEntryIds.length > 0 && newInv?.id) {
          await api.vendorLedger.linkToInvoice(selectedEntryIds, newInv.id)
        }
      }
      setModalOpen(false)
      load()
      toast.success(editing ? 'Vendor invoice updated successfully' : 'Vendor invoice created successfully')
    } catch {
      toast.error('Failed to save vendor invoice')
    }
  }

  const handleDelete = (inv: VendorInvoice) => {
    setDeletingId(inv.id)
  }

const toISO = (d: string) => {
  if (!d) return ''
  const parts = d.split('/')
  if (parts.length !== 3) return d
  const [dd, mm, yyyy] = parts.map(p => p.trim())
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return d
  return `${yyyy}-${mm}-${dd}`
}
const fmtIsoDate = (d: string) => {
  if (!d) return ''
  const parts = d.split('T')[0].split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

const statusColor: Record<string, string> = {
    Paid: 'bg-accent-success/10 text-accent-success',
    Pending: 'bg-accent-warning/10 text-accent-warning',
    Overdue: 'bg-accent-orange/10 text-accent-orange',
    Cancelled: 'bg-gray-200/50 text-gray-500',
  }

  const columns = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'issue_date', label: 'Issue Date' },
    { key: 'due_date', label: 'Due Date' },
    {
      key: 'total', label: 'Total',
      render: (inv: VendorInvoice) => `Rs ${inv.total.toLocaleString()}`,
    },
    {
      key: 'remaining_balance', label: 'Due',
      render: (inv: VendorInvoice) => `Rs ${inv.remaining_balance.toLocaleString()}`,
    },
    {
      key: 'products', label: 'Products',
      render: (inv: VendorInvoice) => {
        const items = invoiceItems[inv.id] || []
        if (items.length === 0) return <span className="text-brand-text-muted text-xs">—</span>
        return (
          <div className="space-y-0.5">
            {items.map((item, i) => (
              <div key={i} className="text-xs whitespace-nowrap">
                <span className="font-medium">{item.product_name}</span>
                <span className="text-brand-text-muted"> ×{item.quantity} @ Rs {item.rate_per_unit.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )
      },
    },
    {
      key: 'status', label: 'Status',
      render: (inv: VendorInvoice) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[inv.status] || ''}`}>{inv.status}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Vendor Invoices</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-brand-primary text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          Add Purchase Invoice
        </button>
      </div>

      <div className="flex gap-3 items-center">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          onEdit={openEdit}
          onDelete={handleDelete}
          loading={loading}
        />
        {data && <Pagination page={data.page} total={data.total} limit={50} onChange={setPage} />}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Purchase Invoice' : 'Add Purchase Invoice'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Vendor *</label>
              <select value={form.vendor_id} onChange={(e) => { setForm({ ...form, vendor_id: e.target.value }); setSelectedEntryIds([]) }}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                <option value="">Select a vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.mill_name ? ` (${v.mill_name})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Invoice # *</label>
              <input type="text" value={form.invoice_number} readOnly
                placeholder="P-INV-2026-001"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-100 dark:bg-white/[0.02] text-sm text-gray-500 dark:text-gray-400 focus:outline-none cursor-not-allowed" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Issue Date *</label>
              <DateInput value={form.issue_date} onChange={(v) => setForm({ ...form, issue_date: v })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Due Date *</label>
              <DateInput value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })}
                minDate={form.issue_date ? new Date(Number(form.issue_date.split('/')[2]), Number(form.issue_date.split('/')[1]) - 1, Number(form.issue_date.split('/')[0])) : undefined}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
          </div>

          {!editing && pendingEntries.length > 0 && (
            <div className="border border-brand-secondary/20 dark:border-brand-secondary/10 rounded-xl p-3 bg-brand-secondary/5 dark:bg-brand-secondary/[0.03]">
              <p className="text-xs font-medium text-brand-text-muted mb-2">
                Pull from Ledger ({pendingEntries.length} pending)
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {pendingEntries.map((entry) => (
                  <label key={entry.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedEntryIds.includes(entry.id)
                        ? 'bg-brand-primary/10 dark:bg-brand-primary/[0.06]'
                        : 'hover:bg-white/40 dark:hover:bg-white/[0.04]'
                    }`}>
                    <input type="checkbox"
                      checked={selectedEntryIds.includes(entry.id)}
                      onChange={() => handleToggleEntry(entry)}
                      className="rounded border-gray-300 dark:border-white/20 text-brand-primary focus:ring-brand-primary/40" />
                    <span className="text-xs text-brand-text-muted flex-shrink-0">{entry.transaction_datetime?.split('T')[0]}</span>
                    <span className="text-xs font-medium text-brand-text-primary dark:text-white truncate">{entry.product_name}</span>
                    <span className="text-xs text-brand-text-muted flex-shrink-0">×{entry.quantity} @ Rs {entry.rate_per_unit}</span>
                    <span className="text-xs font-medium text-brand-text-primary dark:text-white ml-auto flex-shrink-0">Rs {entry.total_payment.toLocaleString()}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-white/20 dark:border-white/[0.06] pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-brand-text-primary dark:text-white">Line Items</label>
              <button onClick={addItemLine} className="text-xs px-2 py-1 rounded-lg bg-brand-primary/20 text-brand-text-primary hover:bg-brand-primary/30 transition-colors">+ Add Item</button>
            </div>
            {form.items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-start">
                <select value={item.productId} onChange={(e) => handleItemProduct(idx, e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                  <option value="">Select product</option>
                  {inventory.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit}) — stock: {p.quantity}</option>)}
                </select>
                <input type="number" value={item.quantity || ''} onChange={(e) => updateItemLine(idx, 'quantity', Number(e.target.value))}
                  placeholder="Qty" min="0.01" step="0.01"
                  className="w-16 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
                <input type="number" value={item.ratePerUnit || ''} onChange={(e) => updateItemLine(idx, 'ratePerUnit', Number(e.target.value))}
                  placeholder="Rate" min="0" step="0.01"
                  className="w-20 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
                <span className="text-xs text-brand-text-muted py-1.5">Rs {(item.quantity * item.ratePerUnit).toFixed(2)}</span>
                <button onClick={() => removeItemLine(idx)} className="p-1.5 text-red-500 hover:text-red-700">×</button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-brand-text-muted mb-1">Subtotal</label>
              <p className="text-sm font-semibold text-brand-text-primary">Rs {form.subtotal.toFixed(2)}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-text-muted mb-1">Discount</label>
              <input type="number" value={form.discount_amount || ''} onChange={(e) => setForm(recalc({ ...form, discount_amount: Number(e.target.value) }))}
                min="0" step="0.01"
                className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="text-sm font-semibold text-brand-text-primary dark:text-white">Total: Rs {form.total.toFixed(2)}</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Paid Amount</label>
            <input type="number" value={form.paid_amount || ''} onChange={(e) => setForm({ ...form, paid_amount: Number(e.target.value) })}
              min="0" step="0.01"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:bg-white/30 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 text-sm rounded-xl bg-brand-primary text-gray-900 font-medium hover:opacity-90">Save</button>
          </div>
        </div>
      </Modal>
      <ConfirmModal open={deletingId !== null} onClose={() => setDeletingId(null)}
        onConfirm={async () => { if (deletingId) { try { await api.vendorInvoices.delete(deletingId); toast.success('Vendor invoice deleted successfully') } catch { toast.error('Failed to delete vendor invoice') } setDeletingId(null); load() } }}
        title="Delete Vendor Invoice"
        message={`Are you sure you want to delete vendor invoice "${data?.data.find(v => v.id === deletingId)?.invoice_number}"? This action cannot be undone.`}
        confirmLabel="Delete" danger />
    </div>
  )
}