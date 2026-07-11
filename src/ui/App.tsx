import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { applyTheme } from './hooks/useTheme'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Titlebar from './components/Titlebar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'

import Dashboard from './pages/Dashboard'
import VendorsPage from './pages/vendors/VendorsPage'
import CustomersPage from './pages/customers/CustomersPage'
import InventoryPage from './pages/inventory/InventoryPage'
import VendorLedgerPage from './pages/vendor-ledger/VendorLedgerPage'
import CustomerLedgerPage from './pages/customer-ledger/CustomerLedgerPage'
import ExpensesPage from './pages/expenses/ExpensesPage'
import DayClosingPage from './pages/day-closing/DayClosingPage'
import InvoicesPage from './pages/invoices/InvoicesPage'
import VendorInvoicesPage from './pages/vendor-invoices/VendorInvoicesPage'
import SettingsPage from './pages/settings/SettingsPage'

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Titlebar />
        <Header onMenuToggle={() => setSidebarOpen(true)} />

        <main className="relative z-0 flex-1 overflow-y-auto px-5 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function App() {
  useEffect(() => {
    const isDark = (() => {
      try {
        const raw = localStorage.getItem('dark_mode')
        if (raw !== null) return JSON.parse(raw)
      } catch {}
      return false
    })()
    applyTheme(isDark)
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/vendor-ledger" element={<VendorLedgerPage />} />
          <Route path="/customer-ledger" element={<CustomerLedgerPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/vendor-invoices" element={<VendorInvoicesPage />} />
          <Route path="/day-closing" element={<DayClosingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
