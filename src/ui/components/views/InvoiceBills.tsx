import { useState, type FormEvent } from 'react'
import { useData } from '../../context/DataContext'
import AddRecordDrawer from '../AddRecordDrawer'

const statusColor: Record<string, string> = {
  Paid: 'bg-accent-success/10 text-accent-success',
  Pending: 'bg-accent-warning/10 text-accent-warning',
  Overdue: 'bg-accent-orange/10 text-accent-orange',
}

export default function InvoiceBills() {
  const { invoices, addInvoice } = useData()
  const [open, setOpen] = useState(false)
  const [id, setId] = useState('')
  const [customer, setCustomer] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [total, setTotal] = useState('')
  const [error, setError] = useState('')

  const totalReceivable = invoices.reduce((s, inv) => s + inv.total, 0)
  const pendingTotal = invoices.filter((inv) => inv.status === 'Pending').reduce((s, inv) => s + inv.total, 0)
  const overdueTotal = invoices.filter((inv) => inv.status === 'Overdue').reduce((s, inv) => s + inv.total, 0)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!id.trim() || !customer.trim() || !dueDate.trim() || !total.trim()) {
      setError('All fields are required.')
      return
    }
    const amount = parseFloat(total)
    if (isNaN(amount)) { setError('Total must be a number.'); return }
    const today = new Date().toISOString().slice(0, 10)
    addInvoice({ id, customer, issueDate: today, dueDate, total: amount, status: 'Pending' })
    setId(''); setCustomer(''); setDueDate(''); setTotal('')
    setOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Invoices & Bills</h1>
          <p className="text-sm text-brand-text-muted">Accounts receivable ledger with payment tracking.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add New Record
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Total Receivables</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">${totalReceivable.toLocaleString()}</p>
        </div>
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Pending</p>
          <p className="text-2xl font-bold text-accent-warning mt-1">${pendingTotal.toLocaleString()}</p>
        </div>
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Overdue</p>
          <p className="text-2xl font-bold text-accent-orange mt-1">${overdueTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card overflow-hidden shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm text-brand-text-muted border-b border-brand-border">
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Issue Date</th>
                <th className="px-5 py-3 font-medium">Due Date</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-brand-border last:border-0 hover:bg-brand-bg transition-colors" style={{ height: '52px' }}>
                  <td className="px-5 text-sm font-medium text-brand-text-primary">{inv.id}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{inv.customer}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{inv.issueDate}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{inv.dueDate}</td>
                  <td className="px-5 text-sm text-right font-medium text-brand-text-primary">${inv.total.toLocaleString()}</td>
                  <td className="px-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[inv.status]}`}>{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddRecordDrawer open={open} onClose={() => setOpen(false)} title="Add Invoice">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Invoice ID</label>
            <input type="text" value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. INV-2026-008" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Customer</label>
            <input type="text" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. Alice Johnson" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Total Amount</label>
            <input type="text" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="e.g. 4200" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          {error && <p className="text-sm text-accent-orange">{error}</p>}
          <button type="submit" className="w-full py-2.5 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">Add Invoice</button>
        </form>
      </AddRecordDrawer>
    </div>
  )
}
