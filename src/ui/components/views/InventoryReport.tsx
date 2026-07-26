import { useState, type FormEvent } from 'react'
import { useData } from '../../context/DataContext'
import AddRecordDrawer from '../AddRecordDrawer'

const statusStyle: Record<string, string> = {
  'In Stock': 'bg-accent-success/10 text-accent-success',
  'Low Stock': 'bg-accent-warning/10 text-accent-warning',
  'Out of Stock': 'bg-accent-orange/10 text-accent-orange',
}

export default function InventoryReport() {
  const { inventory, addInventoryItem } = useData()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')

  const lowStock = inventory.filter((i) => i.stockStatus === 'Low Stock')
  const outOfStock = inventory.filter((i) => i.stockStatus === 'Out of Stock')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !sku.trim() || !category.trim() || !qty.trim()) {
      setError('All fields are required.')
      return
    }
    const qtyNum = parseInt(qty, 10)
    if (isNaN(qtyNum) || qtyNum < 0) { setError('Stock count must be a non-negative number.'); return }
    const stockStatus = qtyNum === 0 ? 'Out of Stock' : qtyNum <= 25 ? 'Low Stock' : 'In Stock'
    addInventoryItem({ name, sku, category, stockStatus, qty: qtyNum, unitCost: 0 })
    setName(''); setSku(''); setCategory(''); setQty('')
    setOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Inventory Report</h1>
          <p className="text-sm text-brand-text-muted">Stock thresholds and product availability.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add New Record
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Total Products</p>
          <p className="text-2xl font-bold text-brand-text-primary mt-1">{inventory.length}</p>
        </div>
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Low Stock</p>
          <p className="text-2xl font-bold text-accent-warning mt-1">{lowStock.length}</p>
        </div>
        <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card px-5 py-4 shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
          <p className="text-sm text-brand-text-muted">Out of Stock</p>
          <p className="text-2xl font-bold text-accent-orange mt-1">{outOfStock.length}</p>
        </div>
      </div>

      <div className="bg-brand-card backdrop-blur-xl border border-brand-border rounded-card overflow-hidden shadow-premium-md hover:shadow-premium-lg transition-all duration-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm text-brand-text-muted border-b border-brand-border">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 text-right font-medium">Qty</th>
                <th className="px-5 py-3 text-right font-medium">Unit Cost</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.sku} className="border-b border-brand-border last:border-0 hover:bg-brand-bg transition-colors" style={{ height: '52px' }}>
                  <td className="px-5 text-sm font-medium text-brand-text-primary">{item.name}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{item.sku}</td>
                  <td className="px-5 text-sm text-brand-text-secondary">{item.category}</td>
                  <td className="px-5 text-sm text-right font-medium text-brand-text-primary">{item.qty}</td>
                  <td className="px-5 text-sm text-right text-brand-text-secondary">${item.unitCost}</td>
                  <td className="px-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[item.stockStatus]}`}>{item.stockStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddRecordDrawer open={open} onClose={() => setOpen(false)} title="Add Inventory Item">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Item Title</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wireless Headphones" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">SKU Code</label>
            <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. WH-200" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Electronics" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Stock Volume</label>
            <input type="text" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 340" className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          {error && <p className="text-sm text-accent-orange">{error}</p>}
          <button type="submit" className="w-full py-2.5 rounded-button bg-[#6B7280] text-white font-semibold text-sm hover:brightness-105 transition-all">Add Item</button>
        </form>
      </AddRecordDrawer>
    </div>
  )
}
