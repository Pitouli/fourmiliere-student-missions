import { useState, useEffect, useCallback } from 'react'
import { callEdgeFunction } from '@/lib/supabase'
import type { OrganizationCredentialRow, PublicOrganisation } from '@/types'

export function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationCredentialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const loadOrganizations = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fnErr } = await callEdgeFunction<{ organizations: OrganizationCredentialRow[] }>(
      'admin-list-organization-codes',
      { method: 'GET' },
    )
    if (fnErr || !data) {
      setError(fnErr || 'Erreur lors du chargement')
      setLoading(false)
      return
    }
    setOrganizations(data.organizations)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])

  async function handleToggle(id: string) {
    const { error: fnErr } = await callEdgeFunction(
      `admin-list-organization-codes?toggle=${id}`,
      { method: 'GET' },
    )
    if (fnErr) {
      setError(fnErr)
      return
    }
    loadOrganizations()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Codes organizations</h1>
          <p className="text-base-content/50 text-sm mt-1">
            {organizations.length} organization{organizations.length > 1 ? 's' : ''} configurée{organizations.length > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Ajouter une organization
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
          <button onClick={loadOrganizations} className="btn btn-sm btn-ghost">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : organizations.length === 0 ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body items-center text-center py-12">
            <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-base-content/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-6 6M9 7a2 2 0 00-2 2m-4 0a6 6 0 006 6m6-6V5a2 2 0 00-2-2H7a2 2 0 00-2 2v4a6 6 0 0012 0z" />
              </svg>
            </div>
            <p className="text-base-content/50 font-medium">Aucune organization configurée</p>
            <p className="text-base-content/40 text-sm mt-1">
              Ajoutez une organization pour permettre la validation par code secret
            </p>
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>ID public</th>
                  <th>Statut</th>
                  <th>Code modifié le</th>
                  <th>Ajoutée le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id}>
                    <td className="font-medium">{org.name}</td>
                    <td className="text-sm text-base-content/50 font-mono">{org.external_id}</td>
                    <td>
                      <span className={`badge badge-sm ${org.is_active ? 'badge-success' : 'badge-ghost'}`}>
                        {org.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="text-sm text-base-content/60">
                      {new Date(org.code_last_changed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="text-sm text-base-content/60">
                      {new Date(org.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="btn btn-ghost btn-xs"
                          title="Modifier le code"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleToggle(org.id)}
                          className={`btn btn-ghost btn-xs ${org.is_active ? 'text-error' : 'text-success'}`}
                          title={org.is_active ? 'Désactiver' : 'Activer'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddOrganizationModal
          existing={organizations}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadOrganizations() }}
        />
      )}
    </div>
  )
}

// ============ Add Organization Modal ============
function AddOrganizationModal({ existing, onClose, onSuccess }: { existing: OrganizationCredentialRow[]; onClose: () => void; onSuccess: () => void }) {
  const [search, setSearch] = useState('')
  const [publicOrgs, setPublicOrgs] = useState<PublicOrganisation[]>([])
  const [selectedOrg, setSelectedOrg] = useState<PublicOrganisation | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setOrgsLoading(true)
      const { data, error: fnErr } = await callEdgeFunction<{ organisations: PublicOrganisation[] }>(
        'list-public-organisations', { method: 'GET' },
      )
      if (!fnErr && data) setPublicOrgs(data.organisations)
      setOrgsLoading(false)
    })()
  }, [])

  const filtered = publicOrgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.external_id.includes(search),
  )

  const existingIds = new Set(existing.map((e) => e.external_id))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedOrg) { setError('Sélectionnez une organization'); return }
    if (!/^\d{6}$/.test(code)) { setError('Le code doit contenir exactement 6 chiffres'); return }
    setLoading(true)
    const { error: fnErr } = await callEdgeFunction('admin-upsert-organization-code', {
      body: { externalId: selectedOrg.external_id, code, name: selectedOrg.name },
    })
    setLoading(false)
    if (fnErr) { setError(fnErr); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-base-100 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h2 className="font-bold text-lg mb-4">Ajouter / modifier une organization</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}

            <div className="form-control">
              <label className="label-text font-medium block mb-1">Organization</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="input input-bordered w-full mb-2"
              />
              {orgsLoading ? (
                <div className="flex justify-center py-4">
                  <span className="loading loading-spinner loading-sm"></span>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-base-300 rounded-lg">
                  {filtered.length === 0 ? (
                    <p className="text-sm text-base-content/40 text-center py-4">Aucune organization trouvée</p>
                  ) : (
                    filtered.slice(0, 20).map((org) => (
                      <button
                        key={org.external_id}
                        type="button"
                        onClick={() => setSelectedOrg(org)}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-base-200 last:border-0 transition-colors ${
                          selectedOrg?.external_id === org.external_id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-base-200'
                        }`}
                      >
                        <span>{org.name}</span>
                        {existingIds.has(org.external_id) && (
                          <span className="badge badge-xs badge-warning ml-2">Déjà configurée</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedOrg && (
                <p className="text-sm text-base-content/60 mt-2">
                  Sélectionnée: <strong>{selectedOrg.name}</strong>
                </p>
              )}
            </div>

            <div className="form-control">
              <label className="label-text font-medium block mb-1">Code à 6 chiffres</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="input input-bordered w-full text-center text-2xl font-bold tracking-widest"
                maxLength={6}
                required
              />
              <p className="text-xs text-base-content/40 mt-1">
                Zéros initiaux autorisés. Le code ne sera plus affiché après enregistrement.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="btn btn-ghost">Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
