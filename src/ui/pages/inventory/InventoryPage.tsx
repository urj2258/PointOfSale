import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import type { InventoryItem, PaginatedResult } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import SearchInput from '../../components/ui/SearchInput'
import Modal from '../../components/ui/Modal'

export default function InventoryPage() {
  const [data, setData] = useState<PaginatedResult<InventoryItem> | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null)

  const [form, setForm] = useState({ name: '', unit: '', description: '' })
  const [stockForm, setStockForm] = useState({ change: 0 })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const result = await api.inventory.list(search || undefined, page, 50)
    setData(result)
    setLoading(false)
  }, [search, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', unit: '', description: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (item: InventoryItem) => {
    setEditing(item)
    setForm({ name: item.name, unit: item.unit, description: item.description || '' })
    setError('')
    setModalOpen(true)
  }

  const openStock = (item: InventoryItem) => {
    setStockItem(item)
    setStockForm({ change: 0 })
    setError('')
    setStockModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.unit.trim()) { setError('Name and unit are required'); return }
    setError('')
    if (editing) {
      await api.inventory.update(editing.id, form.name, form.unit, form.description || undefined)
    } else {
      await api.inventory.create(form.name, form.unit, 0, form.description || undefined)
    }
    setModalOpen(false)
    load()
  }

  const handleStockSubmit = async () => {
    if (!stockItem || stockForm.change === 0) { setError('Enter a quantity change'); return }
    setError('')
    await api.inventory.adjustStock(stockItem.id, stockForm.change)
    setStockModalOpen(false)
    load()
  }

  const handleDelete = async (item: InventoryItem) => {
    if (confirm(`Delete "${item.name}"?`)) {
      await api.inventory.delete(item.id)
      load()
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'unit', label: 'Unit' },
    {
      key: 'quantity', label: 'Quantity',
      render: (item: InventoryItem) => (
        <span className={item.quantity <= 10 ? 'text-orange-600 font-medium' : ''}>
          {item.quantity}
        </span>
      ),
    },
    { key: 'description', label: 'Description' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Inventory</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-brand-primary text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          Add Product
        </button>
      </div>

      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search products..." />

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] overflow-hidden">
        <DataTable
          columns={[
            ...columns,
            {
              key: 'stock_action', label: '',
              render: (item: InventoryItem) => (
                <button onClick={() => openStock(item)}
                  className="text-xs px-2 py-1 rounded-lg bg-brand-primary/20 text-brand-text-primary hover:bg-brand-primary/30 transition-colors">
                  Adjust Stock
                </button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Unit *</label>
            <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="e.g. kg, pieces, bags"
              className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:bg-white/30 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 text-sm rounded-xl bg-brand-primary text-gray-900 font-medium hover:opacity-90">Save</button>
          </div>
        </div>
      </Modal>

      <Modal open={stockModalOpen} onClose={() => setStockModalOpen(false)} title={`Adjust Stock — ${stockItem?.name}`}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <p className="text-sm text-brand-text-muted">Current stock: <strong>{stockItem?.quantity} {stockItem?.unit}</strong></p>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Quantity Change</label>
            <input type="number" value={stockForm.change} onChange={(e) => setStockForm({ change: Number(e.target.value) })}
              placeholder="Positive to add, negative to remove"
              className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          {stockForm.change !== 0 && (
            <p className="text-sm text-brand-text-muted">New stock will be: <strong>{(stockItem?.quantity ?? 0) + stockForm.change} {stockItem?.unit}</strong></p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setStockModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:bg-white/30 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleStockSubmit} className="px-4 py-2 text-sm rounded-xl bg-brand-primary text-gray-900 font-medium hover:opacity-90">Update Stock</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
