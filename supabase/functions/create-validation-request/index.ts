import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const EXPIRY_DAYS = 7

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const API_BASE = 'https://api.lafourmiliere-benevolat.fr'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { eventExternalId, studentEmail } = await req.json()

    if (!eventExternalId || typeof eventExternalId !== 'string') {
      return new Response(JSON.stringify({ error: 'Identifiant d\'événement manquant' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!studentEmail || !validateEmail(studentEmail)) {
      return new Response(JSON.stringify({ error: 'Email étudiant invalide' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const normalizedEmail = studentEmail.toLowerCase().trim()

    // Verify event exists in public API
    const cacheRes = await fetch(`${supabaseUrl}/functions/v1/list-public-events`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${supabaseServiceKey}` },
    })
    if (!cacheRes.ok) {
      return new Response(JSON.stringify({ error: 'Impossible de vérifier l\'événement' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const cacheData = await cacheRes.json()
    const event = (cacheData.events as { external_id: string }[]).find((e) => e.external_id === String(eventExternalId))

    if (!event) {
      return new Response(JSON.stringify({ error: 'Événement introuvable dans le référentiel public' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Upsert student
    const { data: studentId, error: studentErr } = await supabase
      .rpc('upsert_student_by_email', { p_email: normalizedEmail })
    if (studentErr || !studentId) {
      return new Response(JSON.stringify({ error: 'Erreur lors de l\'identification étudiante' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get event_reference id
    const { data: eventRef, error: eventErr } = await supabase
      .from('event_references')
      .select('id')
      .eq('external_id', String(eventExternalId))
      .maybeSingle()
    if (eventErr || !eventRef) {
      return new Response(JSON.stringify({ error: 'Événement non trouvé en base' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
      return new Response(JSON.stringify({ error: 'Cet événement a déjà été validé' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Invalidate old pending requests for same student+event
    await supabase
      .from('validation_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('event_id', eventRef.id)
      .eq('status', 'pending')

    // Create new validation request
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data: validationRequest, error: vrErr } = await supabase
      .from('validation_requests')
      .insert({
        student_id: studentId,
        event_id: eventRef.id,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (vrErr || !validationRequest) {
      return new Response(JSON.stringify({ error: 'Erreur lors de la création de la demande' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      id: validationRequest.id,
      expires_at: expiresAt,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
