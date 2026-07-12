import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import type { Customer, PaginatedResult } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import SearchInput from '../../components/ui/SearchInput'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import toast from 'react-hot-toast'

type Form = { name: string; phone: string; address: string; shop_name: string }
type FieldErrors = { name?: string; phone?: string; address?: string; shop_name?: string }

function validateField<K extends keyof Form>(field: K, value: string): string | undefined {
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
        /^03\d{9}$/.test(digits) ||
        /^923\d{9}$/.test(digits) ||
        /^3\d{9}$/.test(digits) ||
        /^0[24-9]\d{8,9}$/.test(digits) ||
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
  }
}

function isFormValid(form: Form): boolean {
  return !validateField('name', form.name) &&
    !validateField('phone', form.phone) &&
    !validateField('address', form.address) &&
    !validateField('shop_name', form.shop_name)
}

export default function CustomersPage() {
  const [data, setData] = useState<PaginatedResult<Customer> | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  const [form, setForm] = useState<Form>({ name: '', phone: '', address: '', shop_name: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)



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
    setFieldErrors({})
    setServerError('')
    setTouched({})
    setModalOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setForm({ name: customer.name, phone: customer.phone || '', address: customer.address || '', shop_name: customer.shop_name || '' })
    setFieldErrors({})
    setServerError('')
    setTouched({})
    setModalOpen(true)
  }

  const setField = <K extends keyof Form>(field: K, value: string) => {
    const updated = { ...form, [field]: value }
    setForm(updated)
    if (touched[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: validateField(field, value) }))
    }
  }

  const onBlur = (field: keyof Form) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    setFieldErrors(prev => ({ ...prev, [field]: validateField(field, form[field]) }))
  }

  const handleSubmit = async () => {
    const errors: FieldErrors = {
      name: validateField('name', form.name),
      phone: validateField('phone', form.phone),
      address: validateField('address', form.address),
      shop_name: validateField('shop_name', form.shop_name),
    }
    setFieldErrors(errors)
    setTouched({ name: true, phone: true, address: true, shop_name: true })

    if (Object.values(errors).some(Boolean)) return

    setServerError('')
    try {
      let result: any
      if (editing) {
        result = await api.customers.update(editing.id, form.name.trim(), form.phone.trim(), form.address.trim(), form.shop_name.trim() || undefined)
      } else {
        result = await api.customers.create(form.name.trim(), form.phone.trim(), form.address.trim(), form.shop_name.trim() || undefined)
      }
      if (result?.error) {
        setServerError(result.error)
        return
      }
      setModalOpen(false)
      load()
      toast.success(editing ? 'Customer updated successfully' : 'Customer created successfully')
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
      toast.error('An unexpected error occurred')
    }
  }

  const handleDelete = (customer: Customer) => {
    setDeletingId(customer.id)
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'shop_name', label: 'Shop Name' },
  ]

  const inputClass = (field: keyof Form) =>
    `w-full px-3 py-2 rounded-xl border text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${
      fieldErrors[field]
        ? 'border-red-400 focus:ring-red-400/40 bg-red-50 dark:bg-red-900/10'
        : 'border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] focus:ring-brand-primary/40'
    }`

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
          {serverError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{serverError}</p>}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} onBlur={() => onBlur('name')}
              className={inputClass('name')} placeholder="e.g. Ahmed Traders" />
            {touched.name && fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Phone *</label>
            <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} onBlur={() => onBlur('phone')}
              onKeyDown={(e) => { if (e.key.length === 1 && /[a-zA-Z]/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault() }}
              onPaste={(e) => { e.preventDefault(); const input = e.target as HTMLInputElement; const start = input.selectionStart ?? input.value.length; const end = input.selectionEnd ?? input.value.length; const cleaned = (e.clipboardData.getData('text') || '').replace(/[^0-9+\-]/g, ''); setField('phone', input.value.slice(0, start) + cleaned + input.value.slice(end)); }}
              className={inputClass('phone')} placeholder="e.g. 03XXXXXXXXX" inputMode="numeric" />
            {touched.phone && fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Address *</label>
            <input type="text" value={form.address} onChange={(e) => setField('address', e.target.value)} onBlur={() => onBlur('address')}
              className={inputClass('address')} placeholder="e.g. Main Boulevard, Karachi" />
            {touched.address && fieldErrors.address && <p className="text-xs text-red-500 mt-1">{fieldErrors.address}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Shop Name</label>
            <input type="text" value={form.shop_name} onChange={(e) => setField('shop_name', e.target.value)} onBlur={() => onBlur('shop_name')}
              className={inputClass('shop_name')} placeholder="e.g. Khan Electronics" />
            {touched.shop_name && fieldErrors.shop_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.shop_name}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:bg-white/30 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleSubmit} disabled={!isFormValid(form)} className="px-4 py-2 text-sm rounded-xl bg-brand-primary text-gray-900 font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">Save</button>
          </div>
        </div>
      </Modal>
      <ConfirmModal open={deletingId !== null} onClose={() => setDeletingId(null)}
        onConfirm={async () => { if (deletingId) { try { await api.customers.delete(deletingId); toast.success('Customer deleted successfully') } catch { toast.error('Failed to delete customer') } setDeletingId(null); load() } }}
        title="Delete Customer"
        message={`Are you sure you want to delete customer "${data?.data.find(v => v.id === deletingId)?.name}"? This action cannot be undone.`}
        confirmLabel="Delete" danger />
    </div>
  )
}
