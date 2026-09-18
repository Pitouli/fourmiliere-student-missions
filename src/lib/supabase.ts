import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const EDGE_FUNCTION_BASE = `${supabaseUrl}/functions/v1`

export async function callEdgeFunction<T = unknown>(
  name: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { method = 'POST', body } = options
  const { data: sessionData } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
  }
  if (sessionData.session?.access_token) {
    headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
  } else {
    headers['Authorization'] = `Bearer ${supabaseAnonKey}`
  }

  try {
    const res = await fetch(`${EDGE_FUNCTION_BASE}/${name}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let parsed: unknown = null
    if (text) {
      try { parsed = JSON.parse(text) } catch { parsed = text }
    }
    if (!res.ok) {
      const errMsg = (parsed && typeof parsed === 'object' && 'error' in parsed)
        ? String((parsed as { error: unknown }).error)
        : typeof parsed === 'string' ? parsed : `Erreur ${res.status}`
      return { data: null, error: errMsg, status: res.status }
    }
    return { data: parsed as T, error: null, status: res.status }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Erreur réseau', status: 0 }
  }
}
