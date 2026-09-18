import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AdminInfo {
  userId: string
  email: string | undefined
}

interface AuthContextValue {
  session: Session | null
  adminInfo: AdminInfo | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        checkAdmin(data.session)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      if (sess) {
        (async () => {
          await checkAdmin(sess)
        })()
      } else {
        setAdminInfo(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function checkAdmin(sess: Session) {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('user_id, is_active')
      .eq('user_id', sess.user.id)
      .maybeSingle()

    if (data?.is_active) {
      setAdminInfo({ userId: sess.user.id, email: sess.user.email })
    } else {
      setAdminInfo(null)
    }
    setLoading(false)
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAdminInfo(null)
  }

  return (
    <AuthContext.Provider value={{ session, adminInfo, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
