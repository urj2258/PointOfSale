import { useState, type FormEvent } from 'react'
import { useData } from '../../context/DataContext'
import AddRecordDrawer from '../AddRecordDrawer'

export default function BankAccountTransaction() {
  const { transactions, addTransaction } = useData()
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState('Main Operating')
  const [type, setType] = useState<'Credit' | 'Debit'>('Credit')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const lastBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!description.trim() || !amount.trim()) {
      setError('Description and Amount are required.')
      return
    }
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) { setError('Amount must be a positive number.'); return }

    const nextId = `TXN-${String(transactions.length + 1).padStart(3, '0')}`
    const today = new Date().toISOString().slice(0, 10)
    const newBalance = type === 'Credit' ? lastBalance + num : lastBalance - num

    addTransaction({ id: nextId, date: today, description, account, type, amount: num, balance: newBalance })
    setDescription(''); setAmount(''); setType('Credit'); setAccount('Main Operating')
    setOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Bank Transactions</h1>
          <p className="text-sm text-brand-text-muted">Checkbook-style register of all banking activity.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add New Record
        </button>
      </div>

      <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card overflow-hidden shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm text-brand-text-muted border-b border-brand-border">
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Account</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-b border-brand-border last:border-0 hover:bg-brand-bg transition-colors" style={{ height: '52px' }}>
                  <td className="px-5 text-sm font-medium text-brand-text-primary">{txn.id}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{txn.date}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{txn.description}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{txn.account}</td>
                  <td className={`px-5 text-sm text-right font-medium ${txn.type === 'Credit' ? 'text-accent-success' : 'text-accent-orange'}`}>
                    {txn.type === 'Credit' ? '+' : '-'}${txn.amount.toLocaleString()}
                  </td>
                  <td className="px-5 text-sm text-right font-medium text-brand-text-primary">${txn.balance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddRecordDrawer open={open} onClose={() => setOpen(false)} title="Add Transaction">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Account</label>
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary outline-none focus:border-brand-primary transition-colors">
              <option value="Main Operating">Main Operating</option>
              <option value="Petty Cash">Petty Cash</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Transaction Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'Credit' | 'Debit')} className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary outline-none focus:border-brand-primary transition-colors">
              <option value="Credit">Credit (+)</option>
              <option value="Debit">Debit (-)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Client payment" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Amount</label>
            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 4200" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          {error && <p className="text-sm text-accent-orange">{error}</p>}
          <button type="submit" className="w-full py-2.5 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">Add Transaction</button>
        </form>
      </AddRecordDrawer>
    </div>
  )
}
