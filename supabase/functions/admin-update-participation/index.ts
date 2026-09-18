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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const userId = await getUserFromToken(req)
    if (!userId || !(await isAdmin(userId))) {
      return new Response(JSON.stringify({ error: 'Accès non autorisé' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { participationId, hours, reason } = await req.json()

    if (!participationId) {
      return new Response(JSON.stringify({ error: 'ID participation manquant' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (typeof hours !== 'number' || hours < 0) {
      return new Response(JSON.stringify({ error: 'Heures invalides' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!reason || reason.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Motif obligatoire' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const roundedHours = Math.round(hours * 100) / 100

    // Get current participation
    const { data: part, error: partErr } = await supabase
      .from('participations')
      .select('id, hours, max_hours_at_validation, deleted_at')
      .eq('id', participationId)
      .maybeSingle()

    if (partErr || !part) {
      return new Response(JSON.stringify({ error: 'Participation introuvable' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (part.deleted_at) {
      return new Response(JSON.stringify({ error: 'Participation supprimée' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (roundedHours > Number(part.max_hours_at_validation)) {
      return new Response(JSON.stringify({ error: `Les heures ne peuvent pas dépasser ${part.max_hours_at_validation}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const beforeData = { hours: Number(part.hours) }

    const { error: updateErr } = await supabase
      .from('participations')
      .update({ hours: roundedHours, admin_reason: reason.trim(), updated_at: new Date().toISOString() })
      .eq('id', participationId)

    if (updateErr) {
      return new Response(JSON.stringify({ error: 'Erreur lors de la modification' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await supabase.from('audit_logs').insert({
      actor_user_id: userId,
      action: 'update_participation',
      entity_type: 'participation',
      entity_id: participationId,
      reason: reason.trim(),
      before_data: beforeData,
      after_data: { hours: roundedHours },
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
