import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const API_BASE = 'https://api.lafourmiliere-benevolat.fr'
const CACHE_TTL_MINUTES = 30

interface RawOrganisation {
  id: number
  name: string
  website?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const search = url.searchParams.get('search') || undefined

    const cacheKey = 'organisations_all'
    const { data: cached } = await supabase
      .from('api_cache')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .maybeSingle()

    let organisations: { external_id: string; name: string; website: string | null }[] = []

    if (cached && new Date(cached.expires_at) > new Date()) {
      organisations = cached.value as typeof organisations
    } else {
      const res = await fetch(`${API_BASE}/v1/organisations`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      if (!data.organisations || !Array.isArray(data.organisations)) {
        throw new Error('Invalid API response format')
      }
      organisations = (data.organisations as RawOrganisation[]).map((org) => ({
        external_id: String(org.id),
        name: org.name,
        website: org.website || null,
      }))

      await supabase.from('api_cache').upsert({
        key: cacheKey,
        value: organisations,
        expires_at: new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000).toISOString(),
      })
    }

    let filtered = organisations
    if (search) {
      const lowerSearch = search.toLowerCase()
      filtered = organisations.filter((o) => o.name.toLowerCase().includes(lowerSearch))
    }

    return new Response(JSON.stringify({ organisations: filtered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur lors de la récupération des organisations' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
