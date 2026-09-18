import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, callEdgeFunction } from '@/lib/supabase'
import { getStudentEmail, clearStudentEmail } from '@/lib/studentSession'
import type { Participation, PublicEvent } from '@/types'

export function StudentDashboardPage() {
  const navigate = useNavigate()
  const email = getStudentEmail()
  const [participations, setParticipations] = useState<Participation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [creatingRequest, setCreatingRequest] = useState<string | null>(null)

  const loadParticipations = useCallback(async () => {
    if (!email) {
      navigate('/')
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: rpcErr } = await supabase
      .rpc('get_participations_by_email', { p_email: email })

    if (rpcErr) {
      setError('Erreur lors du chargement de vos participations')
      setLoading(false)
      return
    }

    setParticipations((data || []) as Participation[])
    setLoading(false)
  }, [email, navigate])

  useEffect(() => {
    loadParticipations()
  }, [loadParticipations])

  function handleLogout() {
    clearStudentEmail()
    navigate('/')
  }

  async function loadEvents() {
    setEventsLoading(true)
    setEventsError(null)
    const { data, error: fnErr } = await callEdgeFunction<PublicEvent[]>(
      'list-public-events',
      { method: 'GET' },
    )
    // The function returns { events: [...] } not a flat array
    const responseData = data as unknown as { events: PublicEvent[] } | null
    if (fnErr || !responseData) {
      setEventsError(fnErr || 'Erreur lors du chargement des événements')
      setEventsLoading(false)
      return
    }
    // Filter out already-validated events client-side
    const validatedIds = new Set(participations.map((p) => p.event_external_id))
    setEvents(responseData.events.filter((e) => !validatedIds.has(e.external_id)))
    setEventsLoading(false)
  }

  async function handleSelectEvent(event: PublicEvent) {
    setCreatingRequest(event.external_id)
    const { data, error: fnErr } = await callEdgeFunction<{ id: string }>(
      'create-validation-request',
      { body: { eventExternalId: event.external_id, studentEmail: email } },
    )
    setCreatingRequest(null)
    if (fnErr || !data) {
      setEventsError(fnErr || 'Erreur lors de la création de la demande')
      return
    }
    navigate(`/validate/${data.id}`)
  }

  function openAddModal() {
    setShowAddModal(true)
    loadEvents()
  }

  const totalHours = participations.reduce((sum, p) => sum + Number(p.hours), 0)

  if (!email) {
    navigate('/')
    return null
  }

  return (
    <div className="min-h-screen bg-base-200 safe-top safe-bottom">
      <header className="bg-base-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-content" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="font-bold text-base-content">Bénébloc</span>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Email banner */}
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body py-3 px-4">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-base-content/40 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-base-content/60">Connecté en tant que</span>
              <span className="font-medium text-base-content">{email}</span>
            </div>
          </div>
        </div>

        {/* Total hours card */}
        <div className="card bg-primary text-primary-content shadow-lg mb-4 overflow-hidden">
          <div className="card-body py-6">
            <p className="text-primary-content/80 text-sm font-medium">Total d'heures validées</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold">{totalHours.toLocaleString('fr-FR')}</span>
              <span className="text-xl text-primary-content/80">h</span>
            </div>
            <p className="text-primary-content/60 text-sm mt-1">
              {participations.length} participation{participations.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Add event button */}
        <button
          onClick={openAddModal}
          className="btn btn-primary w-full gap-2 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un événement
        </button>

        {/* Participations list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : error ? (
          <div className="alert alert-error">
            <span>{error}</span>
            <button onClick={loadParticipations} className="btn btn-sm btn-ghost text-error-content">Réessayer</button>
          </div>
        ) : participations.length === 0 ? (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body items-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-base-content/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-base-content/60 font-medium">Aucune participation validée</p>
              <p className="text-base-content/40 text-sm mt-1">
                Ajoutez un événement pour commencer à valider vos heures bénévoles
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {participations.map((p) => (
              <div key={p.id} className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow animate-fade-in">
                <div className="card-body py-4 px-4 flex-row items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base-content truncate">{p.event_name}</h3>
                    {p.organization_name && (
                      <p className="text-sm text-base-content/50 mt-0.5">Validé par {p.organization_name}</p>
                    )}
                    <p className="text-xs text-base-content/40 mt-1">
                      {new Date(p.validated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-2xl font-bold text-primary">{Number(p.hours)}</div>
                    <div className="text-xs text-base-content/40">heures</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/admin/login" className="text-sm text-base-content/40 hover:text-base-content/70 transition-colors">
            Espace administration
          </Link>
        </div>
      </main>

      {/* Add event modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div
            className="bg-base-100 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-base-300">
              <h2 className="font-bold text-lg">Événements disponibles</h2>
              <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-sm btn-circle">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {eventsLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
              ) : eventsError ? (
                <div className="alert alert-error">
                  <span>{eventsError}</span>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-base-content/50">
                  Aucun événement disponible pour le moment
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <button
                      key={event.external_id}
                      onClick={() => handleSelectEvent(event)}
                      disabled={creatingRequest !== null}
                      className="card bg-base-200 hover:bg-base-300 transition-colors w-full text-left disabled:opacity-50"
                    >
                      <div className="card-body py-3 px-4">
                        <div className="flex items-start gap-3">
                          {event.image_url && (
                            <img
                              src={event.image_url}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover shrink-0"
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm text-base-content line-clamp-2">{event.name}</h3>
                            {event.category && (
                              <span className="inline-flex items-center gap-1 text-xs text-base-content/50 mt-1">
                                <span>{event.category.emoji}</span>
                                {event.category.name}
                              </span>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs text-base-content/60">
                                {new Date(event.starts_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                              <span className="text-xs font-medium text-primary">{event.max_hours}h max</span>
                            </div>
                          </div>
                          {creatingRequest === event.external_id ? (
                            <span className="loading loading-spinner loading-sm text-primary"></span>
                          ) : (
                            <svg className="w-5 h-5 text-base-content/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
