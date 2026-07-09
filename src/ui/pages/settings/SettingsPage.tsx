import { useState } from 'react'
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
  const { config, update, reset, presets } = useTheme()
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
      const res = await api.db.export()
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

        <div>
          <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-2">Theme Presets</label>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button key={p.name} onClick={() => update(p.config)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  config.dark === p.config.dark && config.primary === p.config.primary && config.secondary === p.config.secondary
                    ? 'bg-brand-primary text-gray-900 border-brand-primary'
                    : 'bg-white/30 dark:bg-white/[0.06] text-brand-text-muted border-white/30 dark:border-white/[0.1] hover:bg-white/50 dark:hover:bg-white/[0.1]'
                }`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Primary Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.primary} onChange={(e) => update({ primary: e.target.value })}
                className="w-10 h-10 rounded-xl border border-gray-200 dark:border-white/[0.1] cursor-pointer bg-transparent" />
              <span className="text-xs text-brand-text-muted font-mono">{config.primary}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-1">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.secondary} onChange={(e) => update({ secondary: e.target.value })}
                className="w-10 h-10 rounded-xl border border-gray-200 dark:border-white/[0.1] cursor-pointer bg-transparent" />
              <span className="text-xs text-brand-text-muted font-mono">{config.secondary}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text-primary dark:text-white mb-2">Gradient Colors</label>
          <p className="text-xs text-brand-text-muted mb-3">Customize the background gradient stops used across the app and login page.</p>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {(['gradient1', 'gradient2', 'gradient3', 'gradient4', 'gradient5'] as const).map((key, i) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <input type="color" value={config[key]} onChange={(e) => update({ [key]: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-gray-200 dark:border-white/[0.1] cursor-pointer bg-transparent" />
                <span className="text-[10px] text-brand-text-muted font-mono">{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="h-8 rounded-xl overflow-hidden border border-white/20 dark:border-white/[0.08]"
            style={{ background: `linear-gradient(135deg, ${config.gradient1}, ${config.gradient2}, ${config.gradient3}, ${config.gradient4}, ${config.gradient5})` }} />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <span className="text-sm text-brand-text-primary dark:text-white">Dark Mode</span>
            <button onClick={() => update({ dark: !config.dark })}
              className={`relative w-11 h-6 rounded-full transition-colors ${config.dark ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-white/[0.15]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${config.dark ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <button onClick={reset}
            className="px-3 py-1.5 text-xs rounded-xl border border-white/30 dark:border-white/[0.1] text-brand-text-muted hover:bg-white/30 dark:hover:bg-white/[0.08]">
            Reset Defaults
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