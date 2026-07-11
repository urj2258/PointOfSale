import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface DashboardStats {
  vendorCount: number
  customerCount: number
  inventoryCount: number
  lowStockCount: number
  todaySales: number
  todayPurchases: number
  todayExpenses: number
  recentTransactions: { type: string; transaction_datetime: string; party: string; amount: number }[]
  lowStockItems: { id: string; name: string; unit: string; quantity: number; description: string | null }[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const threshold = Number(localStorage.getItem('low_stock_threshold')) || 10
    api.dashboard.stats(threshold).then((data: DashboardStats) => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-center py-12 text-brand-text-muted">Loading...</div>
  if (!stats) return <div className="text-center py-12 text-brand-text-muted">Failed to load dashboard</div>

  const cards = [
    { label: 'Total Vendors', value: stats.vendorCount, color: 'bg-blue-500/10 text-blue-600' },
    { label: 'Total Customers', value: stats.customerCount, color: 'bg-green-500/10 text-green-600' },
    { label: 'Inventory Items', value: stats.inventoryCount, color: 'bg-purple-500/10 text-purple-600' },
    { label: 'Low Stock Items', value: stats.lowStockCount, color: 'bg-orange-500/10 text-orange-600' },
    { label: "Today's Sales", value: `Rs. ${stats.todaySales.toLocaleString()}`, color: 'bg-emerald-500/10 text-emerald-600' },
    { label: "Today's Purchases", value: `Rs. ${stats.todayPurchases.toLocaleString()}`, color: 'bg-rose-500/10 text-rose-600' },
    { label: "Today's Expenses", value: `Rs. ${stats.todayExpenses.toLocaleString()}`, color: 'bg-amber-500/10 text-amber-600' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-5">
            <p className="text-sm text-brand-text-muted mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color.split(' ')[1]}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-5">
          <h2 className="text-lg font-semibold text-brand-text-primary dark:text-white mb-4">Recent Transactions</h2>
          <div className="space-y-2">
            {stats.recentTransactions.length === 0 && (
              <p className="text-sm text-brand-text-muted">No recent transactions</p>
            )}
            {stats.recentTransactions.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/10 dark:border-white/[0.04] last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    t.type === 'Sale' ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'
                  }`}>{t.type}</span>
                  <span className="text-sm text-brand-text-primary dark:text-white">{t.party}</span>
                </div>
                <span className="text-sm font-medium text-brand-text-primary dark:text-white">
                  Rs. {t.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-5">
          <h2 className="text-lg font-semibold text-brand-text-primary dark:text-white mb-4">Low Stock Alert</h2>
          <div className="space-y-2">
            {stats.lowStockItems.length === 0 && (
              <p className="text-sm text-brand-text-muted">All items are well stocked</p>
            )}
            {stats.lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-white/10 dark:border-white/[0.04] last:border-0">
                <span className="text-sm text-brand-text-primary dark:text-white">{item.name}</span>
                <span className="text-sm font-medium text-orange-600">{item.quantity} {item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
