import { useState, useEffect } from 'react'
import { api } from '../../services/api'

interface AuditLog {
  id: string
  action: string
  status: string
  user_id: string
  user_name: string
  details: string | null
  created_at: string
}

export default function BackupLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 50

  useEffect(() => {
    fetchLogs()
  }, [page])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await api.auditLog.list(page, limit)
      setLogs(res.logs)
      setTotalLogs(res.total)
    } catch (err) {
      console.error('Failed to fetch backup logs', err)
    } finally {
      setLoading(false)
    }
  }

  const renderStatus = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400 rounded-full">Success</span>
      case 'failure':
        return <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400 rounded-full">Failure</span>
      case 'partial':
        return <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 rounded-full">Partial</span>
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 rounded-full">{status}</span>
    }
  }

  const renderAction = (action: string) => {
    return action.charAt(0).toUpperCase() + action.slice(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-text-primary">Backup Logs</h1>
        <p className="text-sm text-brand-text-muted mt-1">Audit trail for sync, export, and import actions.</p>
      </div>

      <div className="rounded-2xl bg-brand-card dark:bg-white/[0.04] border-brand-border dark:border-white/[0.06] p-6 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 dark:border-white/[0.05]">
                <th className="py-3 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Action</th>
                <th className="py-3 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">User</th>
                <th className="py-3 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Details</th>
                <th className="py-3 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 dark:divide-white/[0.02]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-brand-text-muted">Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-brand-text-muted">No logs found</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/5 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-medium text-brand-text-primary">{renderAction(log.action)}</td>
                    <td className="py-3 px-4">{renderStatus(log.status)}</td>
                    <td className="py-3 px-4 text-brand-text-secondary">{log.user_name}</td>
                    <td className="py-3 px-4 text-brand-text-secondary truncate max-w-xs" title={log.details || ''}>{log.details || '-'}</td>
                    <td className="py-3 px-4 text-brand-text-secondary whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && totalLogs > limit && (
          <div className="px-4 py-4 flex items-center justify-between border-t border-white/10 dark:border-white/[0.05]">
            <span className="text-sm text-brand-text-muted">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalLogs)} of {totalLogs} logs
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 text-brand-text-primary rounded disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= totalLogs}
                className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 text-brand-text-primary rounded disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
