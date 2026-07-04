import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import type { Customer, PaginatedResult } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import SearchInput from '../../components/ui/SearchInput'
import Modal from '../../components/ui/Modal'

export default function CustomersPage() {
  const [data, setData] = useState<PaginatedResult<Customer> | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  const [form, setForm] = useState({ name: '', phone: '', address: '', shop_name: '' })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const result = await api.customers.list(search || undefined, page, 20)
    setData(result)
    setLoading(false)
  }, [search, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', phone: '', address: '', shop_name: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setForm({ name: customer.name, phone: customer.phone || '', address: customer.address || '', shop_name: customer.shop_name || '' })
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    if (editing) {
      await api.customers.update(editing.id, form.name, form.phone || undefined, form.address || undefined, form.shop_name || undefined)
    } else {
      await api.customers.create(form.name, form.phone || undefined, form.address || undefined, form.shop_name || undefined)
    }
    setModalOpen(false)
    load()
  }

  const handleDelete = async (customer: Customer) => {
    if (confirm(`Delete customer "${customer.name}"?`)) {
      await api.customers.delete(customer.id)
      load()
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'shop_name', label: 'Shop Name' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Customers</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-brand-primary text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          Add Customer
        </button>
      </div>

      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search customers..." />

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] overflow-hidden">
        <DataTable columns={columns} data={data?.data ?? []} onEdit={openEdit} onDelete={handleDelete} loading={loading} />
        {data && <Pagination page={data.page} total={data.total} limit={20} onChange={setPage} />}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Phone</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Address</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-white/[0.1] bg-white/40 dark:bg-white/[0.04] text-sm text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Shop Name</label>
            <input type="text" value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
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
