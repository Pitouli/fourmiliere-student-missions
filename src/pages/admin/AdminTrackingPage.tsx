import { useState, useEffect, useCallback } from 'react'
import { callEdgeFunction, supabase } from '@/lib/supabase'
import type { AdminParticipationRow, PublicEvent } from '@/types'

export function AdminTrackingPage() {
  const [participations, setParticipations] = useState<AdminParticipationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterEvent, setFilterEvent] = useState('')
  const [filterOrg, setFilterOrg] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<AdminParticipationRow | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState<AdminParticipationRow | null>(null)

  const loadParticipations = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fnErr } = await callEdgeFunction<{ participations: AdminParticipationRow[] }>(
      'admin-list-participations',
      { method: 'GET' },
    )
    if (fnErr || !data) {
      setError(fnErr || 'Erreur lors du chargement')
      setLoading(false)
      return
    }
    setParticipations(data.participations)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadParticipations()
  }, [loadParticipations])

  // Extract unique values for filters
  const eventNames = [...new Set(participations.map((p) => p.event_name))].sort()
  const orgNames = [...new Set(participations.filter((p) => p.organization_name).map((p) => p.organization_name!))].sort()

  // Filter participations
  const filtered = participations.filter((p) => {
    if (search && !p.student_email.toLowerCase().includes(search.toLowerCase())) return false
    if (filterEvent && p.event_name !== filterEvent) return false
    if (filterOrg && p.organization_name !== filterOrg) return false
    return true
  })

  async function handleExport(separator: 'comma' | 'semicolon') {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-export-participations?separator=${separator}`
    const { data: session } = await supabase.auth.getSession()
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })
    if (!res.ok) {
      setError('Erreur lors de l\'export')
      return
    }
    const blob = await res.blob()
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `export_participations_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Suivi des étudiants</h1>
          <p className="text-base-content/50 text-sm mt-1">{participations.length} participation{participations.length > 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex gap-2">
          <div className="dropdown dropdown-end">
            <button tabIndex={0} className="btn btn-outline btn-sm gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box shadow-lg w-56 mt-2 z-50 border border-base-300">
              <li><button onClick={() => handleExport('semicolon')} className="text-sm">Séparateur point-virgule (;)</button></li>
              <li><button onClick={() => handleExport('comma')} className="text-sm">Séparateur virgule (,)</button></li>
            </ul>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body py-3 px-4 gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Rechercher par email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className="select select-bordered select-sm w-full"
            >
              <option value="">Tous les événements</option>
              {eventNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
              className="select select-bordered select-sm w-full"
            >
              <option value="">Toutes les organizations</option>
              {orgNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : error ? (
        <div className="alert alert-error">
          <span>{error}</span>
          <button onClick={loadParticipations} className="btn btn-sm btn-ghost">Réessayer</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body items-center text-center py-12">
            <p className="text-base-content/50">Aucune participation trouvée</p>
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Événement</th>
                  <th className="text-right">Heures</th>
                  <th>Organization</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={p.deleted_at ? 'opacity-50' : ''}>
                    <td className="text-sm font-medium">{p.student_email}</td>
                    <td className="text-sm">{p.event_name}</td>
                    <td className="text-sm font-bold text-right">{Number(p.hours)}h</td>
                    <td className="text-sm text-base-content/60">{p.organization_name || '—'}</td>
                    <td>
                      <span className={`badge badge-sm ${p.source === 'admin' ? 'badge-warning' : 'badge-success'}`}>
                        {p.source === 'admin' ? 'Admin' : 'Org.'}
                      </span>
                    </td>
                    <td className="text-sm text-base-content/60">
                      {new Date(p.validated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td>
                      {!p.deleted_at && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setShowEditModal(p)}
                            className="btn btn-ghost btn-xs"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setShowDeleteModal(p)}
                            className="btn btn-ghost btn-xs text-error"
                            title="Supprimer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {p.deleted_at && (
                        <span className="text-xs text-error">Supprimée</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <AddParticipationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadParticipations() }}
        />
      )}

      {/* Edit modal */}
      {showEditModal && (
        <EditParticipationModal
          participation={showEditModal}
          onClose={() => setShowEditModal(null)}
          onSuccess={() => { setShowEditModal(null); loadParticipations() }}
        />
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteParticipationModal
          participation={showDeleteModal}
          onClose={() => setShowDeleteModal(null)}
          onSuccess={() => { setShowDeleteModal(null); loadParticipations() }}
        />
      )}
    </div>
  )
}

// ============ Add Modal ============
function AddParticipationModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [studentEmail, setStudentEmail] = useState('')
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null)
  const [hours, setHours] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data, error: fnErr } = await callEdgeFunction<{ events: PublicEvent[] }>(
        'list-public-events', { method: 'GET' },
      )
      if (!fnErr && data) setEvents(data.events)
    })()
  }, [])

  function handleSelectEvent(externalId: string) {
    const event = events.find((e) => e.external_id === externalId)
    setSelectedEvent(event || null)
    if (event) setHours(event.max_hours)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!studentEmail.trim() || !selectedEvent || !reason.trim()) {
      setError('Tous les champs sont obligatoires')
      return
    }
    setLoading(true)
    const { error: fnErr } = await callEdgeFunction('admin-create-participation', {
      body: { studentEmail: studentEmail.trim().toLowerCase(), eventExternalId: selectedEvent.external_id, hours, reason: reason.trim() },
    })
    setLoading(false)
    if (fnErr) { setError(fnErr); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-base-100 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h2 className="font-bold text-lg mb-4">Ajouter une participation</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
            <div className="form-control">
              <label className="label-text font-medium block mb-1">Email étudiant</label>
              <input type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} className="input input-bordered w-full" required />
            </div>
            <div className="form-control">
              <label className="label-text font-medium block mb-1">Événement</label>
              <select value={selectedEvent?.external_id || ''} onChange={(e) => handleSelectEvent(e.target.value)} className="select select-bordered w-full" required>
                <option value="">Sélectionner...</option>
                {events.map((ev) => <option key={ev.external_id} value={ev.external_id}>{ev.name} ({ev.max_hours}h max)</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label-text font-medium block mb-1">Heures {selectedEvent && `(max: ${selectedEvent.max_hours}h)`}</label>
              <input type="number" value={hours} onChange={(e) => setHours(Math.min(parseFloat(e.target.value) || 0, selectedEvent?.max_hours || 0))} min={0} max={selectedEvent?.max_hours || 0} step={0.25} className="input input-bordered w-full" required />
            </div>
            <div className="form-control">
              <label className="label-text font-medium block mb-1">Motif (obligatoire)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="textarea textarea-bordered w-full" rows={2} required placeholder="Raison de l'ajout manuel..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="btn btn-ghost">Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ============ Edit Modal ============
function EditParticipationModal({ participation, onClose, onSuccess }: { participation: AdminParticipationRow; onClose: () => void; onSuccess: () => void }) {
  const [hours, setHours] = useState(Number(participation.hours))
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!reason.trim()) { setError('Motif obligatoire'); return }
    setLoading(true)
    const { error: fnErr } = await callEdgeFunction('admin-update-participation', {
      body: { participationId: participation.id, hours, reason: reason.trim() },
    })
    setLoading(false)
    if (fnErr) { setError(fnErr); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-base-100 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h2 className="font-bold text-lg mb-4">Modifier la participation</h2>
          <div className="text-sm text-base-content/60 mb-4 space-y-1">
            <p><strong>Étudiant:</strong> {participation.student_email}</p>
            <p><strong>Événement:</strong> {participation.event_name}</p>
            <p><strong>Max:</strong> {Number(participation.max_hours_at_validation)}h</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
            <div className="form-control">
              <label className="label-text font-medium block mb-1">Heures (max: {Number(participation.max_hours_at_validation)}h)</label>
              <input type="number" value={hours} onChange={(e) => setHours(Math.min(parseFloat(e.target.value) || 0, Number(participation.max_hours_at_validation)))} min={0} max={Number(participation.max_hours_at_validation)} step={0.25} className="input input-bordered w-full" required />
            </div>
            <div className="form-control">
              <label className="label-text font-medium block mb-1">Motif (obligatoire)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="textarea textarea-bordered w-full" rows={2} required placeholder="Raison de la modification..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="btn btn-ghost">Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Modifier'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ============ Delete Modal ============
function DeleteParticipationModal({ participation, onClose, onSuccess }: { participation: AdminParticipationRow; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!reason.trim()) { setError('Motif obligatoire'); return }
    setLoading(true)
    const { error: fnErr } = await callEdgeFunction('admin-delete-participation', {
      body: { participationId: participation.id, reason: reason.trim() },
    })
    setLoading(false)
    if (fnErr) { setError(fnErr); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-base-100 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h2 className="font-bold text-lg mb-2">Supprimer la participation</h2>
          <div className="alert alert-warning mb-4 text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Suppression logique — la participation restera traçable en base</span>
          </div>
          <div className="text-sm text-base-content/60 mb-4 space-y-1">
            <p><strong>Étudiant:</strong> {participation.student_email}</p>
            <p><strong>Événement:</strong> {participation.event_name}</p>
            <p><strong>Heures:</strong> {Number(participation.hours)}h</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
            <div className="form-control">
              <label className="label-text font-medium block mb-1">Motif (obligatoire)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="textarea textarea-bordered w-full" rows={2} required placeholder="Raison de la suppression..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="btn btn-ghost">Annuler</button>
              <button type="submit" className="btn btn-error" disabled={loading}>
                {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Supprimer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
