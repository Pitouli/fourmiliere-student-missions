import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { setStudentEmail, normalizeEmail, isValidEmail, getStudentEmail } from '@/lib/studentSession'
import { useEffect } from 'react'
import { BrandLogo } from '@/components/BrandLogo'

export function StudentLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (getStudentEmail()) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Veuillez saisir votre adresse email')
      return
    }

    if (!isValidEmail(email)) {
      setError('Adresse email invalide')
      return
    }

    setSubmitting(true)
    const normalized = normalizeEmail(email)
    setStudentEmail(normalized)
    setTimeout(() => {
      navigate('/dashboard')
    }, 300)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-base-200 to-base-100 flex items-center justify-center safe-top safe-bottom px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-in">
          <BrandLogo className="w-16 h-16 rounded-2xl bg-base-100 ring-1 ring-base-300 mb-4 shadow-lg shadow-base-300/30" />
          <h1 className="text-3xl font-bold text-base-content">Brindille</h1>
          <p className="text-base-content/60 mt-2">Validation de vos événements bénévoles</p>
        </div>

        <form onSubmit={handleSubmit} className="card bg-base-100 shadow-xl animate-scale-in">
          <div className="card-body gap-4">
            {error && (
              <div className="alert alert-error animate-scale-in">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Adresse email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full text-base"
                placeholder="prenom.nom@example.org"
                required
                autoComplete="email"
                autoFocus
              />
              <label className="label">
                <span className="label-text-alt text-base-content/50">
                  Saisissez l'email utilisé pour vos participations
                </span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary w-full text-base" disabled={submitting}>
              {submitting ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <>
                  S'identifier
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="text-center mt-6">
          <Link to="/admin/login" className="text-sm text-base-content/40 hover:text-base-content/70 transition-colors">
            Espace administration
          </Link>
        </div>
      </div>
    </div>
  )
}
