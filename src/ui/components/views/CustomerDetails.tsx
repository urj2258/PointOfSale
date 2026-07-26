import { useState, type FormEvent } from 'react'
import { useData } from '../../context/DataContext'
import AddRecordDrawer from '../AddRecordDrawer'

export default function CustomerDetails() {
  const { customers, addCustomer } = useData()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('Active')
  const [error, setError] = useState('')

  const filtered = customers.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'All' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const activeCustomers = customers.filter((c) => c.status === 'Active')
  const totalLTV = customers.reduce((s, c) => s + c.lifetimeValue, 0)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !phone.trim()) {
      setError('Name and Phone are required.')
      return
    }
    addCustomer({ name, phone, totalOrders: 0, lifetimeValue: 0, status })
    setName(''); setPhone(''); setStatus('Active')
    setOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Customer Details</h1>
          <p className="text-sm text-brand-text-muted">Track customer relationships and lifetime value.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add New Record
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Total Customers</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">{customers.length}</p>
        </div>
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Active Customers</p>
          <p className="text-2xl font-bold text-accent-success mt-1">{activeCustomers.length}</p>
        </div>
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Total Lifetime Value</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">${totalLTV.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/40 dark:bg-white/[0.06] border border-white/20 dark:border-white/[0.06] text-sm text-brand-text-secondary flex-1 backdrop-blur-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm text-brand-text-primary placeholder:text-brand-text-muted flex-1" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 rounded-full bg-white/40 dark:bg-white/[0.06] border border-white/20 dark:border-white/[0.06] text-sm text-brand-text-primary outline-none backdrop-blur-xl">
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card overflow-hidden shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm text-brand-text-muted border-b border-brand-border">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 text-right font-medium">Orders</th>
                <th className="px-5 py-3 text-right font-medium">LTV</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.phone} className="border-b border-brand-border last:border-0 hover:bg-brand-bg transition-colors" style={{ height: '52px' }}>
                  <td className="px-5 text-sm font-medium text-brand-text-primary">{c.name}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{c.phone}</td>
                  <td className="px-5 text-sm text-right text-brand-text-primary">{c.totalOrders}</td>
                  <td className="px-5 text-sm text-right font-medium text-brand-text-primary">${c.lifetimeValue.toLocaleString()}</td>
                  <td className="px-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.status === 'Active' ? 'bg-accent-success/10 text-accent-success' : 'bg-brand-border text-brand-text-muted'}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddRecordDrawer open={open} onClose={() => setOpen(false)} title="Add Customer">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Customer Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alice Johnson" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Phone</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. (555) 123-4567" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary outline-none focus:border-brand-primary transition-colors">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          {error && <p className="text-sm text-accent-orange">{error}</p>}
          <button type="submit" className="w-full py-2.5 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">Add Customer</button>
        </form>
      </AddRecordDrawer>
    </div>
  )
}
