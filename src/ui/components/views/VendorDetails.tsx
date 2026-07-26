import { useState, type FormEvent } from 'react'
import { useData } from '../../context/DataContext'
import AddRecordDrawer from '../AddRecordDrawer'

export default function VendorDetails() {
  const { vendors, addVendor } = useData()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [category, setCategory] = useState('')
  const [balanceDue, setBalanceDue] = useState('')
  const [error, setError] = useState('')

  const totalBalance = vendors.reduce((s, v) => s + v.balanceDue, 0)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !code.trim() || !category.trim() || !balanceDue.trim()) {
      setError('All fields are required.')
      return
    }
    const amount = parseFloat(balanceDue)
    if (isNaN(amount)) { setError('Balance Due must be a number.'); return }
    addVendor({ name, code, category, balanceDue: amount, lastPayment: new Date().toISOString().slice(0, 10) })
    setName(''); setCode(''); setCategory(''); setBalanceDue('')
    setOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Vendor Details</h1>
          <p className="text-sm text-brand-text-muted">Accounts payable overview and supplier ledger.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add New Record
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Total Vendors</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">{vendors.length}</p>
        </div>
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Total Balance Due</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">${totalBalance.toLocaleString()}</p>
        </div>
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Avg Balance Per Vendor</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">${vendors.length ? Math.round(totalBalance / vendors.length).toLocaleString() : '0'}</p>
        </div>
      </div>

      <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card overflow-hidden shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm text-brand-text-muted border-b border-brand-border">
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 text-right font-medium">Balance Due</th>
                <th className="px-5 py-3 font-medium">Last Payment</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.code} className="border-b border-brand-border last:border-0 hover:bg-brand-bg transition-colors" style={{ height: '52px' }}>
                  <td className="px-5 text-sm font-medium text-brand-text-primary">{v.name}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{v.code}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{v.category}</td>
                  <td className="px-5 text-sm text-right font-medium text-brand-text-primary">${v.balanceDue.toLocaleString()}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{v.lastPayment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddRecordDrawer open={open} onClose={() => setOpen(false)} title="Add Vendor">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Vendor Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. TechDistrib Inc." className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Vendor Code</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. TD-001" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Electronics" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Initial Balance Due</label>
            <input type="text" value={balanceDue} onChange={(e) => setBalanceDue(e.target.value)} placeholder="e.g. 28450" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          {error && <p className="text-sm text-accent-orange">{error}</p>}
          <button type="submit" className="w-full py-2.5 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">Add Vendor</button>
        </form>
      </AddRecordDrawer>
    </div>
  )
}
