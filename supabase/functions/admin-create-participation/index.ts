import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getUserFromToken(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data } = await supabase.auth.getUser(token)
  return data.user?.id || null
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('admin_profiles')
    .select('is_active')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.is_active === true
}

const API_BASE = 'https://api.lafourmiliere-benevolat.fr'

async function fetchEventMaxHours(externalId: string): Promise<{ maxHours: number; name: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/missions`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.events) return null
    const event = (data.events as { id: number; name: string; starts_at: string; ends_at: string }[]).find((e) => String(e.id) === String(externalId))
    if (!event) return null
    const start = new Date(event.starts_at).getTime()
    const end = new Date(event.ends_at).getTime()
    if (isNaN(start) || isNaN(end) || end <= start) return null
    return { maxHours: Math.round(((end - start) / (1000 * 60 * 60)) * 100) / 100, name: event.name }
  } catch {
    return null
  }
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const userId = await getUserFromToken(req)
    if (!userId || !(await isAdmin(userId))) {
      return new Response(JSON.stringify({ error: 'Accès non autorisé' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { studentEmail, eventExternalId, hours, reason } = await req.json()

    if (!studentEmail || !validateEmail(studentEmail)) {
      return new Response(JSON.stringify({ error: 'Email étudiant invalide' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!eventExternalId) {
      return new Response(JSON.stringify({ error: 'Événement manquant' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (typeof hours !== 'number' || hours < 0) {
      return new Response(JSON.stringify({ error: 'Heures invalides' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Motif obligatoire' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const normalizedEmail = studentEmail.toLowerCase().trim()
    const roundedHours = Math.round(hours * 100) / 100

    // Verify event from public API
    const eventInfo = await fetchEventMaxHours(String(eventExternalId))
    if (!eventInfo) {
      return new Response(JSON.stringify({ error: 'Événement introuvable dans le référentiel public' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (roundedHours > eventInfo.maxHours) {
      return new Response(JSON.stringify({ error: `Les heures ne peuvent pas dépasser ${eventInfo.maxHours}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Upsert student
    const { data: studentId, error: studentErr } = await supabase
      .rpc('upsert_student_by_email', { p_email: normalizedEmail })
    if (studentErr || !studentId) {
      return new Response(JSON.stringify({ error: 'Erreur lors de l\'identification étudiante' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Upsert event reference
    const { data: eventRef, error: eventErr } = await supabase
      .from('event_references')
      .upsert({
        external_id: String(eventExternalId),
        name: eventInfo.name,
        max_hours: eventInfo.maxHours,
        is_active: true,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'external_id' })
      .select('id')
      .single()
    if (eventErr || !eventRef) {
      return new Response(JSON.stringify({ error: 'Erreur lors de l\'enregistrement de l\'événement' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check for existing active participation
    const { data: existing } = await supabase
      .from('participations')
      .select('id')
      .eq('student_id', studentId)
      .eq('event_id', eventRef.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (existing) {
      return new Response(JSON.stringify({ error: 'Cet événement a déjà été validé pour cet étudiant' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Create participation
    const { data: participation, error: insertErr } = await supabase
      .from('participations')
      .insert({
        student_id: studentId,
        event_id: eventRef.id,
        hours: roundedHours,
        max_hours_at_validation: eventInfo.maxHours,
        source: 'admin',
        validated_at: new Date().toISOString(),
        created_by_admin_id: userId,
        admin_reason: reason.trim(),
      })
      .select('id')
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return new Response(JSON.stringify({ error: 'Cet événement a déjà été validé pour cet étudiant' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: 'Erreur lors de la création' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: userId,
      action: 'create_participation',
      entity_type: 'participation',
      entity_id: participation.id,
      reason: reason.trim(),
      after_data: { student_email: normalizedEmail, event_external_id: eventExternalId, hours: roundedHours },
    })

    return new Response(JSON.stringify({ success: true, id: participation.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
