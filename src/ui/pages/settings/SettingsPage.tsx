import { useAuth } from '../../context/AuthContext'

export default function SettingsPage() {
  const { currentUser, logout } = useAuth()

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-text-primary dark:text-white">Settings</h1>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary dark:text-white">Account</h2>
        <div className="space-y-2">
          <p className="text-sm text-brand-text-muted">Logged in as <strong className="text-brand-text-primary dark:text-white">{currentUser?.full_name}</strong></p>
          <p className="text-sm text-brand-text-muted">Email: {currentUser?.email}</p>
        </div>
        <button onClick={logout}
          className="px-4 py-2 bg-red-500/10 text-red-600 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-colors">
          Logout
        </button>
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary dark:text-white">Application</h2>
        <p className="text-sm text-brand-text-muted">POS System v1.0.0</p>
        <p className="text-sm text-brand-text-muted">Database: SQLite (local)</p>
      </div>
    </div>
  )
}
