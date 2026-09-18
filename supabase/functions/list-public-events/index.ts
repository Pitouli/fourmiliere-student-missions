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
const CACHE_TTL_MINUTES = 5

interface RawEvent {
  id: number
  city?: string
  description?: string
  max_attendees?: number
  name: string
  tagline?: string
  zip_code?: string
  starts_at: string
  ends_at: string
  attendees_count?: number
  image_url?: string
  status?: string
  category?: { id: number; name: string; emoji: string }
  organization?: { id: number; name: string; website?: string }
}

function calculateMaxHours(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  if (isNaN(start) || isNaN(end) || end <= start) return 0
  const hours = (end - start) / (1000 * 60 * 60)
  return Math.round(hours * 100) / 100
}

function normalizeEvent(raw: RawEvent) {
  return {
    external_id: String(raw.id),
    name: raw.name,
    description: raw.description || '',
    starts_at: raw.starts_at,
    ends_at: raw.ends_at,
    max_hours: calculateMaxHours(raw.starts_at, raw.ends_at),
    category: raw.category ? { id: raw.category.id, name: raw.category.name, emoji: raw.category.emoji } : null,
    organization: raw.organization ? { id: raw.organization.id, name: raw.organization.name, website: raw.organization.website || null } : null,
    image_url: raw.image_url || null,
  }
}

async function fetchAllEvents(dateFrom?: string, dateTo?: string): Promise<RawEvent[]> {
  const allEvents: RawEvent[] = []
  let cursor: string | null = null

  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    if (cursor) params.set('cursor', cursor)

    const url = `${API_BASE}/v1/missions${params.toString() ? '?' + params.toString() : ''}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`API returned ${res.status}`)
    const data = await res.json()
    if (!data.events || !Array.isArray(data.events)) throw new Error('Invalid API response format')
    allEvents.push(...data.events)
    cursor = data.next_cursor
    if (!cursor) break
  }

  return allEvents
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('date_from') || undefined
    const dateTo = url.searchParams.get('date_to') || undefined
    const excludeStudentEmail = url.searchParams.get('exclude_student_email') || undefined

    // Try cache table first
    const cacheKey = `events_${dateFrom || 'all'}_${dateTo || 'all'}`
    const { data: cached } = await supabase
      .from('api_cache')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .maybeSingle()

    let events: ReturnType<typeof normalizeEvent>[] = []

    if (cached && new Date(cached.expires_at) > new Date()) {
      events = cached.value as typeof events
    } else {
      const rawEvents = await fetchAllEvents(dateFrom, dateTo)
      events = rawEvents.map(normalizeEvent)

      // Store in cache
      await supabase.from('api_cache').upsert({
        key: cacheKey,
        value: events,
        expires_at: new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000).toISOString(),
      })
    }

    // Filter out already-validated events for this student
    if (excludeStudentEmail) {
      const { data: participations } = await supabase
        .rpc('get_participations_by_email', { p_email: excludeStudentEmail.toLowerCase().trim() })
      if (participations && participations.length > 0) {
        const validatedIds = new Set(participations.map((p: { event_external_id: string }) => p.event_external_id))
        events = events.filter((e) => !validatedIds.has(e.external_id))
      }
    }

    // Upsert event references for caching
    for (const event of events) {
      await supabase.from('event_references').upsert({
        external_id: event.external_id,
        name: event.name,
        max_hours: event.max_hours,
        is_active: true,
        source_payload: { category: event.category, organization: event.organization, image_url: event.image_url },
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'external_id' })
    }

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur lors de la récupération des événements' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
