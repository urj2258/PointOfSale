import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import DateInput from '../components/ui/DateInput'
import Card from '../components/ui/Card'

type Period = 'day' | 'month' | 'year' | 'custom'

interface DashboardStats {
  vendorCount: number
  customerCount: number
  inventoryCount: number
  lowStockCount: number
  todaySales: number
  todayPurchases: number
  todayExpenses: number
  todayInvoiceSales: number
  todayVendorInvoicePurchases: number
  pendingInvoices: number
  overdueInvoices: number
  pendingVendorInvoices: number
  overdueVendorInvoices: number
  recentTransactions: { type: string; transaction_datetime: string; party: string; amount: number }[]
  lowStockItems: { id: string; name: string; unit: string; quantity: number; description: string | null }[]
  periodStart: string
  periodEnd: string
}

const fmtDate = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// dd/mm/yyyy → yyyy-mm-dd
const toISO = (d: string) => {
  if (!d) return ''
  const parts = d.split('/')
  if (parts.length !== 3) return d
  const [dd, mm, yyyy] = parts.map(p => p.trim())
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return d
  return `${yyyy}-${mm}-${dd}`
}

// yyyy-mm-dd → dd/mm/yyyy
const toDisplay = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function periodLabel(period: Period, start: string, end: string): string {
  switch (period) {
    case 'day':   return "Today's"
    case 'month': return "This Month's"
    case 'year':  return "This Year's"
    case 'custom': return `(${fmtDate(start)} – ${fmtDate(end)})`
    default:      return "Today's"
  }
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day',    label: 'Day' },
  { value: 'month',  label: 'Month' },
  { value: 'year',   label: 'Year' },
  { value: 'custom', label: 'Custom' },
]

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('day')

  // Custom range — stored as dd/mm/yyyy (DateInput format)
  const todayISO = new Date().toISOString().split('T')[0]
  const [customFrom, setCustomFrom] = useState(toDisplay(todayISO))
  const [customTo,   setCustomTo]   = useState(toDisplay(todayISO))

  const load = useCallback(async () => {
    setLoading(true)
    const threshold = Number(localStorage.getItem('low_stock_threshold')) || 10
    const startDate = period === 'custom' ? toISO(customFrom) || todayISO : undefined
    const endDate   = period === 'custom' ? toISO(customTo)   || todayISO : undefined
    const data = await api.dashboard.stats(threshold, period, startDate, endDate) as DashboardStats
    setStats(data)
    setLoading(false)
  }, [period, customFrom, customTo, todayISO])

  useEffect(() => { load() }, [load])

  const prefix = stats ? periodLabel(period, stats.periodStart, stats.periodEnd) : "Today's"
  const isCustom = period === 'custom'

  return (
    <div className="space-y-6">

      {/* ── Header + period filter ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Dashboard</h1>

        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented pill control */}
          <div className="flex items-center bg-brand-card dark:bg-white/[0.06] border-brand-border dark:border-white/[0.1] rounded-xl p-1 gap-0.5">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  period === p.value
                    ? 'bg-[#6B7280] text-white shadow-sm'
                    : 'text-brand-text-muted hover:text-brand-text-primary dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date pickers — only shown when Custom is active */}
          {isCustom && (
            <div className="flex items-center gap-2">
              <DateInput
                value={customFrom}
                onChange={setCustomFrom}
                placeholder="From"
                className="w-32 px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <span className="text-xs text-brand-text-muted">–</span>
              <DateInput
                value={customTo}
                onChange={setCustomTo}
                placeholder="To"
                className="w-32 px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <button
                onClick={load}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#6B7280] text-white hover:opacity-90 transition-opacity"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Loading / error states ─────────────────────────────────────── */}
      {loading && (
        <div className="text-center py-12 text-brand-text-muted animate-pulse">Loading…</div>
      )}

      {!loading && !stats && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl text-center mx-auto max-w-md">
          Failed to load dashboard
        </div>
      )}

      {!loading && stats && (
        <>
          {/* ── Static count cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Vendors',    value: stats.vendorCount,    color: 'text-blue-500',   bg: 'bg-blue-500/10' },
              { label: 'Total Customers',  value: stats.customerCount,  color: 'text-green-500',  bg: 'bg-green-500/10' },
              { label: 'Inventory Items',  value: stats.inventoryCount, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { label: 'Low Stock Items',  value: stats.lowStockCount,  color: 'text-orange-500', bg: 'bg-orange-500/10' },
            ].map(card => (
              <Card key={card.label}>
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${card.bg} mb-3`}>
                  <span className={`text-sm font-bold ${card.color}`}>#</span>
                </div>
                <p className="text-xs text-brand-text-muted mb-0.5">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value.toLocaleString()}</p>
              </Card>
            ))}
          </div>

          {/* ── Date-filtered financial cards ─────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: `${prefix} Sales`,
                ledger: stats.todaySales,
                invoice: stats.todayInvoiceSales,
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
                icon: '↑',
              },
              {
                label: `${prefix} Purchases`,
                ledger: stats.todayPurchases,
                invoice: stats.todayVendorInvoicePurchases,
                color: 'text-rose-500',
                bg: 'bg-rose-500/10',
                icon: '↓',
              },
              {
                label: `${prefix} Expenses`,
                ledger: stats.todayExpenses,
                invoice: null,
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
                icon: '−',
              },
            ].map(card => (
              <Card key={card.label}>
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${card.bg} mb-3`}>
                  <span className={`text-sm font-bold ${card.color}`}>{card.icon}</span>
                </div>
                <p className="text-xs text-brand-text-muted mb-0.5">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>
                  Rs. {card.ledger.toLocaleString()}
                </p>
                {card.invoice !== null && (
                  <p className="text-xs text-brand-text-muted mt-1">
                    + Rs. {card.invoice.toLocaleString()} via invoices
                  </p>
                )}
              </Card>
            ))}
          </div>

          <Card>
            <h2 className="text-base font-semibold text-brand-text-primary dark:text-white mb-4">Low Stock Alert</h2>
            <div className="space-y-1">
              {stats.lowStockItems.length === 0 && (
                <p className="text-sm text-brand-text-muted py-4 text-center">All items are well stocked ✓</p>
              )}
              {stats.lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-white/10 dark:border-white/[0.04] last:border-0">
                  <span className="text-sm text-brand-text-primary dark:text-white">{item.name}</span>
                  <span className="text-sm font-semibold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
