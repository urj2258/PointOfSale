import { useState, type FormEvent } from 'react'
import { useData } from '../../context/DataContext'
import AddRecordDrawer from '../AddRecordDrawer'

const categoryOptions = ['Rent', 'Utilities', 'Inventory', 'Marketing', 'Payroll', 'Other']

export default function ExpensesDetails() {
  const { expenses, addExpense } = useData()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(categoryOptions[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const categories = [...new Set(expenses.map((e) => e.category))]
  const byCategory = categories.map((cat) => ({
    category: cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!description.trim() || !amount.trim()) {
      setError('Description and Amount are required.')
      return
    }
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) { setError('Amount must be a positive number.'); return }
    const today = new Date().toISOString().slice(0, 10)
    addExpense({ date: today, category, description, amount: num, method: 'Other' })
    setDescription(''); setAmount(''); setCategory(categoryOptions[0])
    setOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Expenses</h1>
          <p className="text-sm text-brand-text-muted">Corporate spending breakdown by category.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add New Record
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Total Expenses</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">${totalExpenses.toLocaleString()}</p>
        </div>
        {byCategory.map((c) => (
          <div key={c.category} className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
            <p className="text-sm text-brand-text-muted">{c.category}</p>
            <p className="text-2xl font-bold text-brand-text-primary mt-1">${c.total.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card overflow-hidden shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm text-brand-text-muted border-b border-brand-border">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Method</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e, i) => (
                <tr key={i} className="border-b border-brand-border last:border-0 hover:bg-brand-bg transition-colors" style={{ height: '52px' }}>
                  <td className="px-5 text-sm text-brand-text-secondary">{e.date}</td>
                  <td className="px-5 text-sm font-medium text-brand-text-primary">{e.category}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{e.description}</td>
                  <td className="px-5 text-sm text-right font-medium text-brand-text-primary">${e.amount.toLocaleString()}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{e.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddRecordDrawer open={open} onClose={() => setOpen(false)} title="Add Expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary outline-none focus:border-brand-primary transition-colors">
              {categoryOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Monthly office rent" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Amount</label>
            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 8500" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          {error && <p className="text-sm text-accent-orange">{error}</p>}
          <button type="submit" className="w-full py-2.5 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">Add Expense</button>
        </form>
      </AddRecordDrawer>
    </div>
  )
}
