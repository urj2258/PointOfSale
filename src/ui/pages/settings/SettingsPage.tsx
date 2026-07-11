import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { api } from '../../services/api'
import { useTheme } from '../../hooks/useTheme'

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
      const totalPushed = res.pushResults.reduce((s, r) => s + (r.pushed ?? 0), 0)
      const totalPulled = res.pullResults.reduce((s, r) => s + (r.pulled ?? 0), 0)

      if (totalFailed > 0) {
        const pushFailDesc = buildFailureDesc(res.pushResults, 'push')
        const pullFailDesc = buildFailureDesc(res.pullResults, 'pull')
        const descParts = [`Pushed: ${totalPushed} | Pulled: ${totalPulled} | Failed: ${totalFailed}`]
        if (pushFailDesc) descParts.push(`\nPush failures:\n${pushFailDesc}`)
        if (pullFailDesc) descParts.push(`\nPull failures:\n${pullFailDesc}`)

        addNotification({
          type: res.pushResults.some(r => r.error) || res.pullResults.some(r => r.error) ? 'sync_failure' : 'sync_partial',
          title: `Sync ${res.success ? 'completed with errors' : 'failed'}`,
          desc: descParts.join(''),
          color: 'accent-orange',
        })
      } else {
        addNotification({
          type: 'sync_success',
          title: 'Sync completed',
          desc: `Pushed: ${totalPushed} | Pulled: ${totalPulled}`,
          color: 'accent-success',
        })
      }
    } catch (err) {
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

      if (totalFailed > 0) {
        const pullFailDesc = buildFailureDesc(res.pullResults, 'pull')
        addNotification({
          type: totalFailed > 0 ? 'sync_partial' : 'sync_success',
          title: 'Pull completed with errors',
          desc: `Pulled: ${res.pullResults.reduce((s, r) => s + (r.pulled ?? 0), 0)} | Failed: ${totalFailed}${pullFailDesc ? '\n' + pullFailDesc : ''}`,
          color: 'accent-orange',
        })
      } else {
        addNotification({
          type: 'sync_success',
          title: 'Pull completed',
          desc: `Pulled: ${res.pullResults.reduce((s, r) => s + (r.pulled ?? 0), 0)}`,
          color: 'accent-success',
        })
      }
    } catch (err) {
      setPullError(String(err))
    } finally {
      setPulling(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setExportMsg(null)
    try {
      const res = await api.db.export(exportPath || undefined)
      if (res.success) {
        setExportMsg(`Exported to: ${res.path}`)
      } else {
        setExportMsg(res.error || 'Export failed')
      }
    } catch (err) {
      setExportMsg(String(err))
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
      setExportMsg(`Export path set to: ${res.path}`)
    } catch (err) {
      setExportMsg(String(err))
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await api.db.import()
      if (res.canceled) {
        setImportMsg(null)
      } else if (res.success) {
        setImportMsg('Database restored successfully. Refresh the app to see the changes.')
      } else {
        setImportMsg(res.error || 'Import failed')
      }
    } catch (err) {
      setImportMsg(String(err))
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

        {syncError && (
          <div className="text-sm text-red-600 bg-red-500/10 rounded-xl px-4 py-3">
            Sync failed: {syncError}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm">
              <span className="text-brand-text-muted">
                Pushed: <strong className="text-brand-text-primary dark:text-white">{totalPushed}</strong>
              </span>
              <span className="text-brand-text-muted">
                Pulled: <strong className="text-brand-text-primary dark:text-white">{totalPulled}</strong>
              </span>
              {totalFailed > 0 && (
                <span className="text-brand-text-muted">
                  Failed: <strong className="text-red-600">{totalFailed}</strong>
                </span>
              )}
            </div>
            {result.success
              ? <p className="text-sm text-green-600">Sync completed successfully.</p>
              : <p className="text-sm text-amber-600">Sync completed with errors.</p>
            }
            <p className="text-xs text-brand-text-muted">
              Synced at: {new Date(result.syncedAt).toLocaleString()}
            </p>

            {failedTables.length > 0 && (
              <div className="space-y-2 mt-2">
                <p className="text-sm font-medium text-brand-text-primary dark:text-white">Failed tables:</p>
                {failedTables.map(t => (
                  <div key={t.table} className="bg-red-500/5 rounded-xl border border-red-500/10 overflow-hidden">
                    <button
                      onClick={() => setExpandedFailed(expandedFailed === t.table ? null : t.table)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left"
                    >
                      <span className="font-medium text-brand-text-primary dark:text-white">
                        {formatTableName(t.table)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-red-600">{t.failed === -1 ? 'Error' : `${t.failed} failed`}</span>
                        {t.failedDetails && t.failedDetails.length > 0 && (
                          <svg className={`w-4 h-4 text-brand-text-muted transition-transform ${expandedFailed === t.table ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {expandedFailed === t.table && t.failedDetails && t.failedDetails.length > 0 && (
                      <div className="px-4 pb-3 space-y-1">
                        {t.failedDetails.map((d, i) => (
                          <div key={i} className="text-xs text-brand-text-muted bg-white/20 dark:bg-white/[0.04] rounded-lg px-3 py-2 break-all">
                            <span className="font-mono text-red-500">ID: {d.id}</span>
                            <br />
                            <span>{d.error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.error && (
                      <div className="px-4 pb-3">
                        <div className="text-xs text-red-500 bg-red-500/5 rounded-lg px-3 py-2 break-all">
                          {t.error}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {pullError && (
          <div className="text-sm text-red-600 bg-red-500/10 rounded-xl px-4 py-3">
            Pull failed: {pullError}
          </div>
        )}

        {pullResult && (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm">
              <span className="text-brand-text-muted">
                Pulled: <strong className="text-brand-text-primary dark:text-white">
                  {pullResult.pullResults.reduce((s, r) => s + (r.pulled ?? 0), 0)}
                </strong>
              </span>
              <span className="text-brand-text-muted">
                Skipped: <strong className="text-brand-text-primary dark:text-white">
                  {pullResult.pullResults.reduce((s, r) => s + (r.skipped ?? 0), 0)}
                </strong>
              </span>
              {pullResult.pullResults.some(r => r.failed > 0) && (
                <span className="text-brand-text-muted">
                  Failed: <strong className="text-red-600">
                    {pullResult.pullResults.reduce((s, r) => s + (r.failed > 0 ? r.failed : 0), 0)}
                  </strong>
                </span>
              )}
            </div>
            {pullResult.success
              ? <p className="text-sm text-green-600">Pull completed successfully.</p>
              : <p className="text-sm text-amber-600">Pull completed with errors.</p>
            }
            <p className="text-xs text-brand-text-muted">
              Synced at: {new Date(pullResult.syncedAt).toLocaleString()}
            </p>

            {pullResult.pullResults.filter(r => r.failed > 0).length > 0 && (
              <div className="space-y-2 mt-2">
                <p className="text-sm font-medium text-brand-text-primary dark:text-white">Failed tables:</p>
                {pullResult.pullResults.filter(r => r.failed > 0).map(t => (
                  <div key={t.table} className="bg-red-500/5 rounded-xl border border-red-500/10 overflow-hidden">
                    <button
                      onClick={() => setExpandedFailed(expandedFailed === `pull-${t.table}` ? null : `pull-${t.table}`)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left"
                    >
                      <span className="font-medium text-brand-text-primary dark:text-white">
                        {formatTableName(t.table)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-red-600">{t.failed === -1 ? 'Error' : `${t.failed} failed`}</span>
                        {t.failedDetails && t.failedDetails.length > 0 && (
                          <svg className={`w-4 h-4 text-brand-text-muted transition-transform ${expandedFailed === `pull-${t.table}` ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {expandedFailed === `pull-${t.table}` && t.failedDetails && t.failedDetails.length > 0 && (
                      <div className="px-4 pb-3 space-y-1">
                        {t.failedDetails.map((d, i) => (
                          <div key={i} className="text-xs text-brand-text-muted bg-white/20 dark:bg-white/[0.04] rounded-lg px-3 py-2 break-all">
                            <span className="font-mono text-red-500">ID: {d.id}</span>
                            <br />
                            <span>{d.error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.error && (
                      <div className="px-4 pb-3">
                        <div className="text-xs text-red-500 bg-red-500/5 rounded-lg px-3 py-2 break-all">
                          {t.error}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-brand-text-primary dark:text-white">Database</h2>
        <p className="text-sm text-brand-text-muted">Export or restore your local database.</p>

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

        {exportMsg && (
          <p className="text-sm text-green-600 bg-green-500/10 rounded-xl px-4 py-3 break-all">
            {exportMsg}
          </p>
        )}

        {importMsg && (
          <p className="text-sm text-brand-text-primary dark:text-white bg-white/30 dark:bg-white/[0.06] rounded-xl px-4 py-3">
            {importMsg}
          </p>
        )}
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