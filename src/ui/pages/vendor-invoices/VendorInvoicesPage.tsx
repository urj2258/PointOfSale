import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import type { InventoryItem, Vendor, VendorInvoice, PaginatedResult } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'

interface ItemLine {
  productId: string
  productName: string
  quantity: number
  ratePerUnit: number
}

const emptyForm = {
  vendor_id: '',
  invoice_number: '',
  issue_date: new Date().toISOString().split('T')[0],
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

  useEffect(() => {
    api.vendors.list(undefined, 1, 999).then((r: PaginatedResult<Vendor>) => setVendors(r.data)).catch(() => {})
    api.inventory.list(undefined, 1, 999).then((r: PaginatedResult<InventoryItem>) => setInventory(r.data)).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.vendorInvoices.list(statusFilter || undefined, undefined, undefined, undefined, page, 50)
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => { load() }, [load])

  const recalc = (f: typeof form) => {
    const subtotal = f.items.reduce((s, i) => s + i.quantity * i.ratePerUnit, 0)
    const total = subtotal + f.tax_amount - f.discount_amount
    return { ...f, subtotal, total: Math.max(0, total) }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
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
        issue_date: inv.issue_date,
        due_date: inv.due_date,
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
        issue_date: inv.issue_date,
        due_date: inv.due_date,
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
    if (editing) {
      await api.vendorInvoices.update(editing.id, form.vendor_id, form.invoice_number, form.issue_date, form.due_date,
        form.subtotal, form.tax_amount, form.discount_amount, form.total, form.paid_amount, editing.status, form.notes || undefined)
      await api.vendorInvoices.replaceItems(editing.id, items)
    } else {
      await api.vendorInvoices.create(form.vendor_id, form.invoice_number, form.issue_date, form.due_date,
        form.subtotal, form.tax_amount, form.discount_amount, form.total, form.paid_amount,
        form.notes || undefined, items)
    }
    setModalOpen(false)
    load()
  }

  const handleDelete = async (inv: VendorInvoice) => {
    if (confirm(`Delete vendor invoice "${inv.invoice_number}"?`)) {
      await api.vendorInvoices.delete(inv.id)
      load()
    }
  }

  const handleMarkPaid = async (inv: VendorInvoice) => {
    if (confirm(`Mark vendor invoice "${inv.invoice_number}" as paid?`)) {
      await api.vendorInvoices.markPaid(inv.id)
      load()
    }
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
      render: (inv: VendorInvoice) => `$${inv.total.toLocaleString()}`,
    },
    {
      key: 'remaining_balance', label: 'Due',
      render: (inv: VendorInvoice) => `$${inv.remaining_balance.toLocaleString()}`,
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
          columns={[
            ...columns,
            {
              key: 'actions', label: '',
              render: (inv: VendorInvoice) => (
                inv.status === 'Pending' || inv.status === 'Overdue' ? (
                  <button onClick={() => handleMarkPaid(inv)}
                    className="text-xs px-2 py-1 rounded-lg bg-accent-success/20 text-accent-success hover:bg-accent-success/30 transition-colors">
                    Mark Paid
                  </button>
                ) : null
              ),
            },
          ]}
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
              <select value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                <option value="">Select a vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.mill_name ? ` (${v.mill_name})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Invoice # *</label>
              <input type="text" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                placeholder="P-INV-2026-001"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Issue Date *</label>
              <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Due Date *</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
          </div>

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
                <span className="text-xs text-brand-text-muted py-1.5">${(item.quantity * item.ratePerUnit).toFixed(2)}</span>
                <button onClick={() => removeItemLine(idx)} className="p-1.5 text-red-500 hover:text-red-700">×</button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-brand-text-muted mb-1">Subtotal</label>
              <p className="text-sm font-semibold text-brand-text-primary">${form.subtotal.toFixed(2)}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-text-muted mb-1">Tax</label>
              <input type="number" value={form.tax_amount || ''} onChange={(e) => setForm(recalc({ ...form, tax_amount: Number(e.target.value) }))}
                min="0" step="0.01"
                className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-text-muted mb-1">Discount</label>
              <input type="number" value={form.discount_amount || ''} onChange={(e) => setForm(recalc({ ...form, discount_amount: Number(e.target.value) }))}
                min="0" step="0.01"
                className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="text-sm font-semibold text-brand-text-primary dark:text-white">Total: ${form.total.toFixed(2)}</label>
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
    </div>
  )
}