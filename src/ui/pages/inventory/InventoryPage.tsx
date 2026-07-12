import { useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import type { InventoryItem, PaginatedResult } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import SearchInput from '../../components/ui/SearchInput'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import toast from 'react-hot-toast'

const ALLOWED_UNITS = [
  'bag',  'ton' , 'kg' , 'gram',
  'liter', 'ml', 'meter',  'cm', 'mm',
  'feet', 'foot', 'inch', 'inches', 'yard', 'yards',
  'pieces', , 'pcs', 'box', , 'carton', 
  'roll',  'drum', 'can', 
  'bottle', 'sack', , 'bundle', 
  'sheet', 'sheets', 'coil', 'coils', 'tank', 
  'set', 'sets', 'pair', 'pairs', 'unit', 
  'dozen', 'quintal'
]

type Form = { name: string; unit: string; quantity: string; description: string }
type FieldErrors = { name?: string; unit?: string; quantity?: string; description?: string }

function validateField<K extends keyof Form>(field: K, value: string): string | undefined {
  const v = value.trim()
  switch (field) {
    case 'name': {
      if (!v) return 'Product name is required.'
      if (v.length < 3 || v.length > 100) return 'Name must be 3-100 characters.'
      if (/^\d+$/.test(v)) return 'Name cannot be purely numbers.'
      if (/^[^a-zA-Z0-9]+$/.test(v)) return 'Name must contain at least one letter or digit.'
      return undefined
    }
    case 'unit': {
      if (!v) return 'Unit is required.'
      if (!ALLOWED_UNITS.includes(v.toLowerCase())) return `Unit must be one of: ${ALLOWED_UNITS.slice(0, 10).join(', ')}, ...`
      return undefined
    }
    case 'quantity': {
      if (v === '' || v === undefined) return 'Quantity is required.'
      const n = Number(v)
      if (!Number.isFinite(n)) return 'Quantity must be a valid number.'
      if (!Number.isInteger(n)) return 'Quantity must be a whole number.'
      if (n < 0) return 'Quantity cannot be negative.'
      return undefined
    }
    case 'description': {
      if (!v) return undefined
      if (v.length < 5 || v.length > 500) return 'Description must be 5-500 characters.'
      if (/^\d+$/.test(v)) return 'Description cannot be purely numbers.'
      if (/^[^a-zA-Z0-9]+$/.test(v)) return 'Description must contain at least one letter or digit.'
      return undefined
    }
  }
}

function isFormValid(form: Form): boolean {
  return !validateField('name', form.name) &&
    !validateField('unit', form.unit) &&
    !validateField('quantity', form.quantity) &&
    !validateField('description', form.description)
}

export default function InventoryPage() {
  const [data, setData] = useState<PaginatedResult<InventoryItem> | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null)
  const [lowStockThreshold, setLowStockThreshold] = useState(() => {
    const saved = localStorage.getItem('low_stock_threshold')
    return saved ? Number(saved) : 10
  })

  const [form, setForm] = useState<Form>({ name: '', unit: '', quantity: '0', description: '' })
  const [stockForm, setStockForm] = useState({ change: '0' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)



  const load = useCallback(async () => {
    setLoading(true)
    const result = await api.inventory.list(search || undefined, page, 50)
    setData(result)
    setLoading(false)
  }, [search, page])

  useEffect(() => { load() }, [load])

  const handleThresholdChange = (val: number) => {
    const clamped = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0
    setLowStockThreshold(clamped)
    localStorage.setItem('low_stock_threshold', String(clamped))
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', unit: '', quantity: '0', description: '' })
    setFieldErrors({})
    setServerError('')
    setTouched({})
    setModalOpen(true)
  }

  const openEdit = (item: InventoryItem) => {
    setEditing(item)
    setForm({ name: item.name, unit: item.unit, quantity: String(item.quantity), description: item.description || '' })
    setFieldErrors({})
    setServerError('')
    setTouched({})
    setModalOpen(true)
  }

  const openStock = (item: InventoryItem) => {
    setStockItem(item)
    setStockForm({ change: '0' })
    setServerError('')
    setModalOpen(false)
    setStockModalOpen(true)
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
      unit: validateField('unit', form.unit),
      quantity: validateField('quantity', form.quantity),
      description: validateField('description', form.description),
    }
    setFieldErrors(errors)
    setTouched({ name: true, unit: true, quantity: true, description: true })
    if (Object.values(errors).some(Boolean)) return

    setServerError('')
    try {
      let result: any
      if (editing) {
        result = await api.inventory.update(editing.id, form.name.trim(), form.unit.trim().toLowerCase(), form.description.trim() || undefined)
        // Also update quantity if it changed
        const newQty = Number(form.quantity)
        const diff = newQty - editing.quantity
        if (diff !== 0) {
          await api.inventory.adjustStock(editing.id, diff)
        }
      } else {
        result = await api.inventory.create(form.name.trim(), form.unit.trim().toLowerCase(), Number(form.quantity), form.description.trim() || undefined)
      }
      if (result?.error) {
        setServerError(result.error)
        return
      }
      setModalOpen(false)
      load()
      toast.success(editing ? 'Product updated successfully' : 'Product created successfully')
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
      toast.error('An unexpected error occurred')
    }
  }

  const handleStockSubmit = async () => {
    if (!stockItem) return
    const n = Number(stockForm.change)
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      setServerError('Quantity change must be a whole number.')
      return
    }
    if (n === 0) {
      setServerError('Quantity change cannot be zero.')
      return
    }
    if ((stockItem.quantity + n) < 0) {
      setServerError(`Insufficient stock. Current: ${stockItem.quantity}, trying to remove ${Math.abs(n)}.`)
      return
    }
    setServerError('')
    await api.inventory.adjustStock(stockItem.id, n)
    setStockModalOpen(false)
    load()
    toast.success('Stock adjusted successfully')
  }

  const handleDelete = (item: InventoryItem) => {
    setDeletingId(item.id)
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'unit', label: 'Unit' },
    {
      key: 'quantity', label: 'Quantity',
      render: (item: InventoryItem) => (
        <span className={item.quantity <= lowStockThreshold ? 'text-orange-600 font-medium' : ''}>
          {item.quantity} {item.quantity <= lowStockThreshold && <span className="text-[10px] text-orange-400 ml-1">low</span>}
        </span>
      ),
    },
    { key: 'description', label: 'Description' },
  ]

  const inputClass = (field: keyof Form) =>
    `w-full px-3 py-2 rounded-xl border text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${
      fieldErrors[field]
        ? 'border-red-400 focus:ring-red-400/40 bg-red-50 dark:bg-red-900/10'
        : 'border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] focus:ring-brand-primary/40'
    }`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Inventory</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-surface/70 backdrop-blur-md shadow-premium-sm border border-white/30 dark:border-white/[0.08]">
            <span className="text-xs text-brand-text-muted whitespace-nowrap">Low stock: ≤</span>
            <input
              type="number"
              min={0}
              value={lowStockThreshold}
              onChange={(e) => handleThresholdChange(Number(e.target.value))}
              className="w-14 text-center text-sm font-semibold text-brand-text-primary bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-brand-primary text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
            Add Product
          </button>
        </div>
      </div>

      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search products..." />

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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-4">
          {serverError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{serverError}</p>}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} onBlur={() => onBlur('name')}
              className={inputClass('name')} placeholder="e.g. Portland Cement" />
            {touched.name && fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Unit *</label>
            <select value={form.unit} onChange={(e) => { setField('unit', e.target.value); setTouched(prev => ({ ...prev, unit: true })); }}
              className={inputClass('unit')}>
              <option value="">Select a unit...</option>
              {ALLOWED_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {touched.unit && fieldErrors.unit && <p className="text-xs text-red-500 mt-1">{fieldErrors.unit}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Quantity *</label>
            <input type="number" min={0} step={1} value={form.quantity} onChange={(e) => setField('quantity', e.target.value)} onBlur={() => onBlur('quantity')}
              className={inputClass('quantity')} placeholder="0"
              onKeyDown={(e) => { if (e.key === '.' || e.key === '-' || e.key === 'e') e.preventDefault() }} />
            {touched.quantity && fieldErrors.quantity && <p className="text-xs text-red-500 mt-1">{fieldErrors.quantity}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} onBlur={() => onBlur('description')}
              className={inputClass('description')} rows={3} placeholder="Optional product description..." />
            {touched.description && fieldErrors.description && <p className="text-xs text-red-500 mt-1">{fieldErrors.description}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:bg-white/30 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleSubmit} disabled={!isFormValid(form)} className="px-4 py-2 text-sm rounded-xl bg-brand-primary text-gray-900 font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">Save</button>
          </div>
        </div>
      </Modal>


      <ConfirmModal open={deletingId !== null} onClose={() => setDeletingId(null)}
        onConfirm={async () => { if (deletingId) { try { await api.inventory.delete(deletingId); toast.success('Product deleted successfully') } catch { toast.error('Failed to delete product') } setDeletingId(null); load() } }}
        title="Delete Item"
        message={`Are you sure you want to delete "${data?.data.find(v => v.id === deletingId)?.name}"? This action cannot be undone.`}
        confirmLabel="Delete" danger />
    </div>
  )
}
