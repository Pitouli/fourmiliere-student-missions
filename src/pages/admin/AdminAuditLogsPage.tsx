import { useState, useEffect, useCallback } from 'react'
import { callEdgeFunction } from '@/lib/supabase'

interface AuditLog {
  id: string
  actor_user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  reason: string | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  create_participation: 'Création de participation',
  update_participation: 'Modification de participation',
  delete_participation: 'Suppression de participation',
  export_csv: 'Export CSV',
  create_organization_code: 'Création de code organization',
  update_organization_code: 'Modification de code organization',
  activate_organization: 'Activation d\'organization',
  deactivate_organization: 'Désactivation d\'organization',
}

export function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fnErr } = await callEdgeFunction<{ logs: AuditLog[] }>(
      'admin-audit-logs',
      { method: 'GET' },
    )
    if (fnErr || !data) {
      setError(fnErr || 'Erreur lors du chargement')
      setLoading(false)
      return
    }
    setLogs(data.logs)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const filtered = logs.filter((l) => {
    if (!filter) return true
    const label = ACTION_LABELS[l.action] || l.action
    return label.toLowerCase().includes(filter.toLowerCase()) ||
      (l.reason || '').toLowerCase().includes(filter.toLowerCase())
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-base-content">Journal d'audit</h1>
        <p className="text-base-content/50 text-sm mt-1">
          {logs.length} opération{logs.length > 1 ? 's' : ''} enregistrée{logs.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Filtrer par action ou motif..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input input-bordered input-sm w-full max-w-xs"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : error ? (
        <div className="alert alert-error">
          <span>{error}</span>
          <button onClick={loadLogs} className="btn btn-sm btn-ghost">Réessayer</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body items-center text-center py-12">
            <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-base-content/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-base-content/50 font-medium">Aucune opération enregistrée</p>
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Type</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="text-sm text-base-content/60 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="text-sm font-medium">
                      {ACTION_LABELS[log.action] || log.action}
                    </td>
                    <td className="text-sm text-base-content/50">{log.entity_type}</td>
                    <td className="text-sm text-base-content/60">{log.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
