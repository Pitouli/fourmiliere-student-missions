import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { callEdgeFunction } from '@/lib/supabase'
import type { ValidationRequestInfo } from '@/types'

export function ValidationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [requestInfo, setRequestInfo] = useState<ValidationRequestInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [hours, setHours] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; hours?: number } | null>(null)
  const [lastSubmitTime, setLastSubmitTime] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [numpadOrder, setNumpadOrder] = useState<number[]>([])
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const COOLDOWN_MS = 3000

  const loadRequest = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const { data, error: fnErr } = await callEdgeFunction<ValidationRequestInfo>(
      `get-validation-request?id=${id}`,
      { method: 'GET' },
    )
    if (fnErr || !data) {
      setError(fnErr || 'Demande introuvable')
      setLoading(false)
      return
    }
    setRequestInfo(data)
    setHours(data.event_max_hours)
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadRequest()
  }, [loadRequest])

  // Shuffle numpad on mount
  useEffect(() => {
    const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[digits[i], digits[j]] = [digits[j], digits[i]]
    }
    setNumpadOrder(digits)
  }, [])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      return
    }
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [countdown > 0])

  function handleDigit(digit: number) {
    if (code.length < 6) {
      setCode(code + String(digit))
    }
  }

  function handleBackspace() {
    setCode(code.slice(0, -1))
  }

  function handleClear() {
    setCode('')
  }

  async function handleValidate() {
    if (!id || !requestInfo) return
    if (code.length !== 6) return
    if (hours < 0 || hours > requestInfo.event_max_hours) return

    const now = Date.now()
    if (now - lastSubmitTime < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastSubmitTime)) / 1000)
      setCountdown(remaining)
      return
    }

    setSubmitting(true)
    setResult(null)
    setLastSubmitTime(Date.now())
    setCountdown(3)

    const { data, error: fnErr } = await callEdgeFunction<{ success: boolean; hours: number; event_name: string; organization_name: string }>(
      'validate-participation',
      { body: { validationRequestId: id, organizationCode: code, hours } },
    )

    setSubmitting(false)

    if (fnErr || !data) {
      setResult({
        success: false,
        message: fnErr || 'Erreur lors de la validation',
      })
      // Reshuffle numpad on error for security
      const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      for (let i = digits.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[digits[i], digits[j]] = [digits[j], digits[i]]
      }
      setNumpadOrder(digits)
      setCode('')
      return
    }

    setResult({
      success: true,
      message: `Participation validée avec succès !`,
      hours: data.hours,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content/50 mt-4">Chargement de la demande...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-base-content mb-2">Demande invalide</h1>
          <p className="text-base-content/50 mb-6">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  // Success screen
  if (result?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-success/10 to-base-100 px-4 safe-top safe-bottom">
        <div className="text-center max-w-sm animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-success flex items-center justify-center mx-auto mb-6 shadow-lg shadow-success/30">
            <svg className="w-10 h-10 text-success-content" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-base-content mb-2">Participation validée !</h1>
          <p className="text-base-content/60 mb-4">{result.message}</p>
          {result.hours !== undefined && (
            <div className="card bg-base-100 shadow-sm mb-6">
              <div className="card-body py-4">
                <p className="text-base-content/50 text-sm">Heures enregistrées</p>
                <p className="text-3xl font-bold text-primary">{result.hours}h</p>
              </div>
            </div>
          )}
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary w-full">
            Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  if (!requestInfo) return null

  // Check if request is already validated/expired
  if (requestInfo.status !== 'pending') {
    const statusMessages: Record<string, string> = {
      validated: 'Cette participation a déjà été validée',
      expired: 'Cette demande de validation a expiré',
      cancelled: 'Cette demande a été annulée',
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-warning" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-base-content mb-2">Demande non disponible</h1>
          <p className="text-base-content/50 mb-6">{statusMessages[requestInfo.status] || 'Demande invalide'}</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-100 safe-top safe-bottom flex flex-col">
      {/* Header */}
      <header className="bg-base-100 border-b border-base-300 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-ghost btn-sm gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Annuler
          </button>
          <span className="text-sm font-medium text-base-content/60">Validation</span>
          <div className="w-20"></div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Student email - large for readability */}
        <div className="text-center mb-5 animate-fade-in">
          <p className="text-xs text-base-content/40 uppercase tracking-wide font-medium mb-1">Étudiant</p>
          <p className="text-xl font-bold text-base-content break-all">{requestInfo.student_email}</p>
        </div>

        {/* Event info card */}
        <div className="card bg-base-200 shadow-sm mb-4 animate-fade-in">
          <div className="card-body py-4 px-4">
            <p className="text-xs text-base-content/40 uppercase tracking-wide font-medium mb-1">Événement</p>
            <h2 className="text-lg font-bold text-base-content">{requestInfo.event_name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="badge badge-primary badge-sm">Max {requestInfo.event_max_hours}h</span>
            </div>
          </div>
        </div>

        {/* Hours input */}
        <div className="mb-5 animate-fade-in">
          <label className="label">
            <span className="label-text font-medium">Nombre d'heures réalisées</span>
            <span className="label-text-alt text-base-content/40">Max: {requestInfo.event_max_hours}h</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={hours}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (isNaN(val)) {
                  setHours(0)
                } else if (val > requestInfo.event_max_hours) {
                  setHours(requestInfo.event_max_hours)
                } else if (val < 0) {
                  setHours(0)
                } else {
                  setHours(Math.round(val * 100) / 100)
                }
              }}
              min={0}
              max={requestInfo.event_max_hours}
              step={0.25}
              className="input input-bordered w-full text-lg font-bold text-center"
            />
            <span className="text-lg font-bold text-base-content/60">h</span>
          </div>
          <p className="text-xs text-base-content/40 mt-1">
            L'organization peut uniquement réduire ce nombre
          </p>
        </div>

        {/* Error / result message */}
        {result && !result.success && (
          <div className="alert alert-error mb-4 animate-scale-in">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm">{result.message}</span>
          </div>
        )}

        {/* Code input display */}
        <div className="mb-4">
          <label className="label">
            <span className="label-text font-medium">Code organization</span>
          </label>
          <div className="flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-11 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  i < code.length
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-base-300 bg-base-200 text-base-content/30'
                }`}
              >
                {i < code.length ? '•' : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-4">
          {numpadOrder.slice(0, 9).map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              disabled={code.length >= 6}
              className="numpad-btn btn btn-ghost btn-lg text-2xl font-bold h-16 min-h-16 bg-base-200 hover:bg-base-300 disabled:opacity-40 border-base-300"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={code.length === 0}
            className="numpad-btn btn btn-ghost btn-lg h-16 min-h-16 bg-base-200 hover:bg-base-300 disabled:opacity-40 text-sm border-base-300"
          >
            Effacer
          </button>
          <button
            onClick={() => handleDigit(numpadOrder[9])}
            disabled={code.length >= 6}
            className="numpad-btn btn btn-ghost btn-lg text-2xl font-bold h-16 min-h-16 bg-base-200 hover:bg-base-300 disabled:opacity-40 border-base-300"
          >
            {numpadOrder[9]}
          </button>
          <button
            onClick={handleBackspace}
            disabled={code.length === 0}
            className="numpad-btn btn btn-ghost btn-lg h-16 min-h-16 bg-base-200 hover:bg-base-300 disabled:opacity-40 border-base-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 9l4-4 4 4M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2z" />
            </svg>
          </button>
        </div>

        {/* Validate button */}
        <button
          onClick={handleValidate}
          disabled={code.length !== 6 || submitting || countdown > 0}
          className="btn btn-primary btn-lg w-full gap-2 mb-3"
        >
          {submitting ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : countdown > 0 ? (
            <span className="text-sm">Patientez {countdown}s...</span>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Valider
            </>
          )}
        </button>

        <p className="text-xs text-base-content/30 text-center mb-2">
          L'organization saisit son code secret à 6 chiffres
        </p>
      </div>
    </div>
  )
}
