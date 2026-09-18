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

// HMAC key for code uniqueness — stored as edge function secret
const HMAC_KEY = Deno.env.get('CODE_HMAC_KEY') || 'benebloc-hmac-secret-key-2026'

function validateCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

async function hmacSha256Hex(message: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', keyData, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function fetchEventMaxHours(externalId: string): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/missions`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.events) return null
    const event = (data.events as { id: number; starts_at: string; ends_at: string }[]).find((e) => String(e.id) === String(externalId))
    if (!event) return null
    const start = new Date(event.starts_at).getTime()
    const end = new Date(event.ends_at).getTime()
    if (isNaN(start) || isNaN(end) || end <= start) return null
    return Math.round(((end - start) / (1000 * 60 * 60)) * 100) / 100
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { validationRequestId, organizationCode, hours } = await req.json()

    // 1. Validate inputs
    if (!validationRequestId || typeof validationRequestId !== 'string') {
      return new Response(JSON.stringify({ error: 'Identifiant de demande manquant' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!organizationCode || !validateCode(organizationCode)) {
      return new Response(JSON.stringify({ error: 'Code organization invalide. Le code doit contenir exactement 6 chiffres.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (typeof hours !== 'number' || isNaN(hours) || hours < 0) {
      return new Response(JSON.stringify({ error: 'Nombre d\'heures invalide' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Round hours to 2 decimals
    const roundedHours = Math.round(hours * 100) / 100

    // 2. Get validation request
    const { data: vrData, error: vrErr } = await supabase
      .rpc('get_validation_request_details', { p_id: validationRequestId })

    if (vrErr || !vrData || vrData.length === 0) {
      return new Response(JSON.stringify({ error: 'Demande de validation inconnue ou expirée' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const vr = vrData[0]

    // Check status
    if (vr.status === 'validated') {
      return new Response(JSON.stringify({ error: 'Cette participation a déjà été traitée' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (vr.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Cette demande a été annulée' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (vr.status === 'expired' || new Date(vr.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Cette demande de validation a expiré' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (vr.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Demande non valide' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Re-verify event max_hours from public API
    const currentMaxHours = await fetchEventMaxHours(vr.event_external_id)
    if (currentMaxHours === null) {
      return new Response(JSON.stringify({ error: 'Événement introuvable dans le référentiel public. Réessayez ultérieurement.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 4. Verify hours range
    if (roundedHours > currentMaxHours) {
      return new Response(JSON.stringify({ error: `Le nombre d'heures ne peut pas dépasser ${currentMaxHours}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 5. Verify code against organization credentials
    const codeHmac = await hmacSha256Hex(organizationCode, HMAC_KEY)
    const { data: orgCred, error: orgErr } = await supabase
      .from('organization_credentials')
      .select('id, name, code_hash, is_active')
      .eq('code_hmac', codeHmac)
      .maybeSingle()

    if (orgErr || !orgCred) {
      return new Response(JSON.stringify({ error: 'Code organization invalide' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!orgCred.is_active) {
      return new Response(JSON.stringify({ error: 'Code organization invalide' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 6. Check for existing active participation (double-check)
    const { data: existingPart } = await supabase
      .from('participations')
      .select('id')
      .eq('student_id', vr.student_id || (await supabase.from('validation_requests').select('student_id').eq('id', validationRequestId).single()).data?.student_id)
      .eq('event_id', vr.event_id || (await supabase.from('validation_requests').select('event_id').eq('id', validationRequestId).single()).data?.event_id)
      .is('deleted_at', null)
      .maybeSingle()

    // Actually, get the student_id and event_id from the validation request directly
    const { data: fullVR } = await supabase
      .from('validation_requests')
      .select('student_id, event_id')
      .eq('id', validationRequestId)
      .single()

    if (!fullVR) {
      return new Response(JSON.stringify({ error: 'Demande introuvable' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: existingPart2 } = await supabase
      .from('participations')
      .select('id')
      .eq('student_id', fullVR.student_id)
      .eq('event_id', fullVR.event_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingPart2) {
      return new Response(JSON.stringify({ error: 'Cet événement a déjà été validé pour cet étudiant' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 7. Create participation + mark validation request as validated
    const now = new Date().toISOString()

    const { error: insertErr } = await supabase
      .from('participations')
      .insert({
        student_id: fullVR.student_id,
        event_id: fullVR.event_id,
        organization_id: orgCred.id,
        validation_request_id: validationRequestId,
        hours: roundedHours,
        max_hours_at_validation: currentMaxHours,
        source: 'organization',
        validated_at: now,
      })

    if (insertErr) {
      // Check for unique constraint violation (concurrent request)
      if (insertErr.code === '23505') {
        return new Response(JSON.stringify({ error: 'Cet événement a déjà été validé pour cet étudiant' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: 'Erreur lors de l\'enregistrement de la participation' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Mark validation request as validated
    await supabase
      .from('validation_requests')
      .update({ status: 'validated', validated_at: now, updated_at: now })
      .eq('id', validationRequestId)

    return new Response(JSON.stringify({
      success: true,
      hours: roundedHours,
      event_name: vr.event_name,
      organization_name: orgCred.name,
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
