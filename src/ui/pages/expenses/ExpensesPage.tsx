import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../../services/api'
import type { Expense, ExpenseCategory, PaginatedResult } from '../../types'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import toast from 'react-hot-toast'
import DateTimeInput from '../../components/ui/DateTimeInput'

const toISODatetime = (dt: string) => {
  if (!dt) return ''
  const [datePart, timePart] = dt.split(' ')
  const parts = datePart.split('/')
  if (parts.length !== 3) return dt
  const [dd, mm, yyyy] = parts.map(p => p.trim())
  return `${yyyy}-${mm}-${dd}T${timePart || '00:00'}`
}
const fmtNowDatetime = () => {
  const n = new Date()
  const dd = String(n.getDate()).padStart(2, '0')
  const mm = String(n.getMonth() + 1).padStart(2, '0')
  const yyyy = n.getFullYear()
  const hh = String(n.getHours()).padStart(2, '0')
  const mi = String(n.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}
const fmtIsoDatetime = (dt: string) => {
  if (!dt) return ''
  const [datePart, timePart] = dt.split('T')
  const [y, m, d] = datePart.split('-')
  return `${d}/${m}/${y} ${timePart || '00:00'}`
}

export default function ExpensesPage() {
  const [data, setData] = useState<PaginatedResult<Expense> | null>(null)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'expenses' | 'categories'>('expenses')

  const [expenseModal, setExpenseModal] = useState(false)
  const [catModal, setCatModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingCat, setEditingCat] = useState<ExpenseCategory | null>(null)

  const [filterCategory, setFilterCategory] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const [expForm, setExpForm] = useState({ category_id: '', transaction_datetime: '', amount: '', description: '' })
  const [catForm, setCatForm] = useState({ name: '' })
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingType, setDeletingType] = useState<'expense' | 'category'>('expense')

  const scrollRef = useRef<HTMLDivElement>(null)
  const savedScrollRef = useRef(0)

  const loadExpenses = useCallback(async () => {
    savedScrollRef.current = scrollRef.current?.scrollTop ?? 0
    setLoading(true)
    const result = await api.expenses.list(filterCategory || undefined, filterMonth || undefined, page, 20)
    setData(result)
    setLoading(false)
  }, [filterCategory, filterMonth, page])

  useEffect(() => {
    if (!loading && savedScrollRef.current > 0) {
      scrollRef.current?.scrollTo({ top: savedScrollRef.current })
      savedScrollRef.current = 0
    }
  }, [loading])

  const loadCategories = useCallback(async () => {
    const result = await api.expenseCategories.list()
    setCategories(result)
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  useEffect(() => {
    if (tab === 'expenses') loadExpenses()
  }, [tab, loadExpenses])

  const openCreateExpense = () => {
    setEditingExpense(null)
    setExpForm({ category_id: '', transaction_datetime: fmtNowDatetime(), amount: '', description: '' })
    setError('')
    setExpenseModal(true)
  }

  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp)
    setExpForm({
      category_id: exp.category_id,
      transaction_datetime: fmtIsoDatetime(exp.transaction_datetime),
      amount: String(exp.amount),
      description: exp.description || '',
    })
    setError('')
    setExpenseModal(true)
  }

  const handleExpenseSubmit = async () => {
    if (!expForm.category_id || !expForm.transaction_datetime) {
      toast.error('Fill all required fields'); return
    }
    if (Number(expForm.amount) <= 0) {
      toast.error('Amount must be a positive value'); return
    }
    setError('')
    const isoDt = toISODatetime(expForm.transaction_datetime)
    try {
      if (editingExpense) {
        await api.expenses.update(editingExpense.id, expForm.category_id, isoDt, Number(expForm.amount), expForm.description || undefined)
      } else {
        await api.expenses.create(expForm.category_id, isoDt, Number(expForm.amount), expForm.description || undefined)
      }
      setExpenseModal(false)
      loadExpenses()
      toast.success(editingExpense ? 'Expense updated successfully' : 'Expense created successfully')
    } catch {
      toast.error('Failed to save expense')
    }
  }

  const handleDeleteExpense = (exp: Expense) => {
    setDeletingId(exp.id)
    setDeletingType('expense')
  }

  const openCreateCat = () => {
    setEditingCat(null)
    setCatForm({ name: '' })
    setError('')
    setCatModal(true)
  }

  const openEditCat = (cat: ExpenseCategory) => {
    setEditingCat(cat)
    setCatForm({ name: cat.name })
    setError('')
    setCatModal(true)
  }

  const handleCatSubmit = async () => {
    if (!catForm.name.trim()) { setError('Name is required'); return }
    setError('')
    try {
      if (editingCat) {
        await api.expenseCategories.update(editingCat.id, catForm.name)
      } else {
        await api.expenseCategories.create(catForm.name)
      }
      setCatModal(false)
      loadCategories()
      toast.success(editingCat ? 'Category updated successfully' : 'Category created successfully')
    } catch {
      toast.error('Failed to save category')
    }
  }

  const handleDeleteCat = (cat: ExpenseCategory) => {
    setDeletingId(cat.id)
    setDeletingType('category')
  }

  const expenseColumns = [
    { key: 'transaction_datetime', label: 'Date', render: (e: Expense) => new Date(e.transaction_datetime).toLocaleDateString() },
    { key: 'category_name', label: 'Category' },
    { key: 'amount', label: 'Amount', render: (e: Expense) => `Rs. ${e.amount.toLocaleString()}` },
    { key: 'description', label: 'Description', render: (e: Expense) => <span className="whitespace-normal break-words max-w-xs block">{e.description || '—'}</span> },
  ]

  const catColumns = [
    { key: 'name', label: 'Name' },
  ]

  return (
    <div ref={scrollRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Expenses</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('categories')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'categories' ? 'bg-[#6B7280] text-white' : 'border border-\[#D1D5DB\] dark:border-white/\[0.1\] text-brand-text-muted'}`}>
            Categories
          </button>
          <button onClick={() => setTab('expenses')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'expenses' ? 'bg-[#6B7280] text-white' : 'border border-\[#D1D5DB\] dark:border-white/\[0.1\] text-brand-text-muted'}`}>
            Expenses
          </button>
        </div>
      </div>

      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openCreateCat} className="px-4 py-2 bg-[#6B7280] text-white rounded-xl text-sm font-medium hover:opacity-90">Add Category</button>
          </div>
          <div className="rounded-2xl bg-brand-card dark:bg-white/[0.04] border-brand-border dark:border-white/[0.06] overflow-hidden">
            <DataTable columns={catColumns} data={categories} onEdit={openEditCat} onDelete={handleDeleteCat} />
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-brand-text-muted mb-1">Category</label>
              <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-text-muted mb-1">Month</label>
              <input type="month" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            </div>
            {(filterCategory || filterMonth) && (
              <button onClick={() => { setFilterCategory(''); setFilterMonth(''); setPage(1) }}
                className="px-3 py-2 text-sm rounded-xl border border-[#D1D5DB] dark:border-white/[0.1] text-brand-text-muted hover:bg-gray-50 dark:hover:bg-white/[0.08]">Clear</button>
            )}
            <div className="flex-1" />
            <button onClick={openCreateExpense} className="px-4 py-2 bg-[#6B7280] text-white rounded-xl text-sm font-medium hover:opacity-90">Add Expense</button>
          </div>

          <div className="rounded-2xl bg-brand-card dark:bg-white/[0.04] border-brand-border dark:border-white/[0.06] overflow-hidden">
            <DataTable columns={expenseColumns} data={data?.data ?? []} onEdit={openEditExpense} onDelete={handleDeleteExpense} loading={loading} />
            {data && <Pagination page={data.page} total={data.total} limit={20} onChange={setPage} />}
          </div>
        </>
      )}

      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title={editingExpense ? 'Edit Expense' : 'Add Expense'}>
        <div className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Category *</label>
            <select value={expForm.category_id} onChange={(e) => setExpForm({ ...expForm, category_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
              <option value="">Select Category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Date & Time *</label>
            <DateTimeInput value={expForm.transaction_datetime} onChange={(v) => setExpForm({ ...expForm, transaction_datetime: v })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Amount *</label>
            <input type="number" value={expForm.amount} placeholder="0" onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} onFocus={(e) => e.target.select()}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Description</label>
            <input type="text" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setExpenseModal(false)} className="px-4 py-2 text-sm rounded-xl border border-[#D1D5DB] dark:border-white/[0.1] text-brand-text-muted hover:bg-gray-50 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleExpenseSubmit} className="px-4 py-2 text-sm rounded-xl bg-[#6B7280] text-white font-medium hover:opacity-90">Save</button>
          </div>
        </div>
      </Modal>

      <Modal open={catModal} onClose={() => setCatModal(false)} title={editingCat ? 'Edit Category' : 'Add Category'}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Name *</label>
            <input type="text" value={catForm.name} onChange={(e) => setCatForm({ name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setCatModal(false)} className="px-4 py-2 text-sm rounded-xl border border-[#D1D5DB] dark:border-white/[0.1] text-brand-text-muted hover:bg-gray-50 dark:hover:bg-white/[0.08]">Cancel</button>
            <button onClick={handleCatSubmit} className="px-4 py-2 text-sm rounded-xl bg-[#6B7280] text-white font-medium hover:opacity-90">Save</button>
          </div>
        </div>
      </Modal>
      <ConfirmModal open={deletingId !== null}
        onClose={() => { setDeletingId(null) }}
        onConfirm={async () => {
          if (!deletingId) return
          try {
            if (deletingType === 'expense') { await api.expenses.delete(deletingId) } else { await api.expenseCategories.delete(deletingId) }
            toast.success(deletingType === 'expense' ? 'Expense deleted successfully' : 'Category deleted successfully')
          } catch {
            toast.error(deletingType === 'expense' ? 'Failed to delete expense' : 'Failed to delete category')
          }
          setDeletingId(null)
          deletingType === 'expense' ? loadExpenses() : loadCategories()
        }}
        title={deletingType === 'expense' ? 'Delete Expense' : 'Delete Category'}
        message={deletingType === 'expense'
          ? 'Are you sure you want to delete this expense? This action cannot be undone.'
          : `Are you sure you want to delete category "${categories.find(c => c.id === deletingId)?.name}"? This action cannot be undone.`}
        confirmLabel="Delete" danger />
    </div>
  )
}
