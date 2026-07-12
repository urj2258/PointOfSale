import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { api } from '../../services/api'
import { useTheme } from '../../hooks/useTheme'
import toast from 'react-hot-toast'

interface FailedDetail {
  id: string
  error: string
}

interface TableResult {
  table: string
  pushed?: number
  pulled?: number
  skipped?: number
  failed: number
  failedDetails?: FailedDetail[]
  error?: string
}

interface SyncResult {
  success: boolean
  pushResults: TableResult[]
  pullResults: TableResult[]
  syncedAt: string
}

function formatTableName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function buildFailureDesc(results: TableResult[], _direction: string): string {
  const failed = results.filter(r => r.failed > 0)
  if (failed.length === 0) return ''
  return failed.map(r => {
    const name = formatTableName(r.table)
    if (r.failed === -1) return `${name}: ${r.error || 'error'}`
    return `${name}: ${r.failed} failed`
  }).join('\n')
}

export default function SettingsPage() {
  const { currentUser, logout } = useAuth()
  const { isDarkMode, toggle } = useTheme()
  const { addNotification } = useNotifications()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [pulling, setPulling] = useState(false)
  const [pullResult, setPullResult] = useState<SyncResult | null>(null)
  const [pullError, setPullError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [expandedFailed, setExpandedFailed] = useState<string | null>(null)
  const [exportPath, setExportPath] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('export_path')
    if (saved) setExportPath(saved)
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)
    setSyncError(null)
    try {
      const res = await api.sync.run() as SyncResult
      setResult(res)

      const totalFailed = [...res.pushResults, ...res.pullResults].reduce((s, r) => s + (r.failed > 0 ? r.failed : 0), 0)
      const totalPushed = res.pushResults.filter(r => r.table !== 'audit_logs').reduce((s, r) => s + (r.pushed ?? 0), 0)
      const totalPulled = res.pullResults.filter(r => r.table !== 'audit_logs').reduce((s, r) => s + (r.pulled ?? 0), 0)

      if (totalFailed > 0) {
        const pushFailDesc = buildFailureDesc(res.pushResults, 'push')
        const pullFailDesc = buildFailureDesc(res.pullResults, 'pull')
        const descParts = [`Pushed: ${totalPushed} | Pulled: ${totalPulled} | Failed: ${totalFailed}`]
        if (pushFailDesc) descParts.push(`\nPush failures:\n${pushFailDesc}`)
        if (pullFailDesc) descParts.push(`\nPull failures:\n${pullFailDesc}`)

        toast.error(`Sync ${res.success ? 'completed with errors' : 'failed'}`);
        addNotification({
          type: res.pushResults.some(r => r.error) || res.pullResults.some(r => r.error) ? 'sync_failure' : 'sync_partial',
          title: `Sync ${res.success ? 'completed with errors' : 'failed'}`,
          desc: descParts.join(''),
          color: 'accent-orange',
        })
      } else {
        toast.success('Sync completed successfully!');
        addNotification({
          type: 'sync_success',
          title: 'Sync completed',
          desc: `Pushed: ${totalPushed} | Pulled: ${totalPulled}`,
          color: 'accent-success',
        })
      }
    } catch (err) {
      toast.error(String(err));
      setSyncError(String(err))
    } finally {
      setSyncing(false)
    }
  }

  const handlePull = async () => {
    setPulling(true)
    setPullResult(null)
    setPullError(null)
    try {
      const res = await api.sync.pull() as SyncResult
      setPullResult(res)

      const totalFailed = res.pullResults.reduce((s, r) => s + (r.failed > 0 ? r.failed : 0), 0)
      const pullTotal = res.pullResults.filter(r => r.table !== 'audit_logs').reduce((s, r) => s + (r.pulled ?? 0), 0)

      if (totalFailed > 0) {
        const pullFailDesc = buildFailureDesc(res.pullResults, 'pull')
        toast.error('Pull completed with errors');
        addNotification({
          type: totalFailed > 0 ? 'sync_partial' : 'sync_success',
          title: 'Pull completed with errors',
          desc: `Pulled: ${pullTotal} | Failed: ${totalFailed}${pullFailDesc ? '\n' + pullFailDesc : ''}`,
          color: 'accent-orange',
        })
      } else {
        toast.success('Pull completed successfully!');
        addNotification({
          type: 'sync_success',
          title: 'Pull completed',
          desc: `Pulled: ${pullTotal}`,
          color: 'accent-success',
        })
      }
    } catch (err) {
      toast.error(String(err));
      setPullError(String(err))
    } finally {
      setPulling(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await api.db.export(exportPath || undefined)
      if (res.success) {
        toast.success('Database exported successfully.')
      } else {
        toast.error(res.error || 'Export failed')
      }
    } catch (err) {
      toast.error(String(err))
    } finally {
      setExporting(false)
    }
  }

  const handleSelectExportPath = async () => {
    try {
      const res = await api.db.selectExportPath()
      if (res.canceled) return
      setExportPath(res.path)
      localStorage.setItem('export_path', res.path)
      toast.success(`Export path set to: ${res.path}`)
    } catch (err) {
      toast.error(String(err))
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await api.db.import()
      if (res.canceled) {
        // do nothing
      } else if (res.success) {
        toast.success('Database restored successfully. Refresh the app to see the changes.')
      } else {
        toast.error(res.error || 'Import failed')
      }
    } catch (err) {
      toast.error(String(err))
    } finally {
      setImporting(false)
    }
  }

  const totalPushed = result?.pushResults.reduce((s, r) => s + (r.pushed ?? 0), 0) ?? 0
  const totalPulled = result?.pullResults.reduce((s, r) => s + (r.pulled ?? 0), 0) ?? 0
  const totalFailed = result
    ? result.pushResults.reduce((s, r) => s + (r.failed > 0 ? r.failed : 0), 0) +
      result.pullResults.reduce((s, r) => s + (r.failed > 0 ? r.failed : 0), 0)
    : 0

  const failedTables = result
    ? [...result.pushResults, ...result.pullResults].filter(r => r.failed > 0)
    : []

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
        <h2 className="text-lg font-semibold text-brand-text-primary dark:text-white">Backup &amp; Sync</h2>
        <p className="text-sm text-brand-text-muted">Sync local data to the cloud database.</p>
        
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <div className="text-red-600 dark:text-red-400 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Emergency Protocol</h3>
            <p className="text-xs text-red-700 dark:text-red-400/90 mt-1">
              If the Sync engine ever fails to push your data to the cloud, <strong>immediately</strong> go to the Database section below and click <strong>Export Database</strong> to save a local copy of your data, then contact the developers ASAP!
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={handleSync} disabled={syncing}
            className="px-4 py-2 bg-brand-primary text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button onClick={handlePull} disabled={pulling}
            className="px-4 py-2 bg-white/30 dark:bg-white/[0.06] text-brand-text-primary dark:text-white rounded-xl text-sm font-medium border border-white/30 dark:border-white/[0.1] hover:bg-white/50 dark:hover:bg-white/[0.1] transition-colors disabled:opacity-50">
            {pulling ? 'Pulling...' : 'Pull'}
          </button>
        </div>


      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary dark:text-white">Database</h2>
        <p className="text-sm text-brand-text-muted">Export or restore your local database.</p>
        
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
          <div className="text-amber-600 dark:text-amber-400 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Important Sync Rule</h3>
            <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-1">
              Always click <strong>Sync Now</strong> (in the section above) before exporting your local database. This guarantees your backup file and the cloud database have identical, up-to-date information.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} disabled={exporting}
            className="px-4 py-2 bg-brand-primary text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {exporting ? 'Exporting...' : 'Export Database'}
          </button>

          <button onClick={handleImport} disabled={importing}
            className="px-4 py-2 bg-white/30 dark:bg-white/[0.06] text-brand-text-primary dark:text-white rounded-xl text-sm font-medium border border-white/30 dark:border-white/[0.1] hover:bg-white/50 dark:hover:bg-white/[0.1] transition-colors disabled:opacity-50">
            {importing ? 'Importing...' : 'Import Database'}
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs text-brand-text-muted whitespace-nowrap">Export Path:</span>
          <span className="text-xs text-brand-text-secondary font-mono truncate min-w-0 flex-1">
            {exportPath || 'Desktop (default)'}
          </span>
          <button onClick={handleSelectExportPath}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:text-brand-text-primary hover:bg-white/30 dark:hover:bg-white/[0.08] transition-all shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Change Directory
          </button>
        </div>


      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary dark:text-white">Appearance</h2>

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-brand-text-primary dark:text-white">Dark Mode</span>
          <button onClick={toggle}
            className={`relative w-11 h-6 rounded-full transition-colors ${isDarkMode ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-white/[0.15]'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${isDarkMode ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary dark:text-white">Application</h2>
        <p className="text-sm text-brand-text-muted">POS System v1.0.0</p>
        <p className="text-sm text-brand-text-muted">Database: SQLite (local) &rarr; Turso (cloud)</p>
      </div>
    </div>
  )
}