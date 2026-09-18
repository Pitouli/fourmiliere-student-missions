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

    const { participationId, reason } = await req.json()

    if (!participationId) {
      return new Response(JSON.stringify({ error: 'ID participation manquant' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!reason || reason.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Motif obligatoire' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const now = new Date().toISOString()

    const { data: part, error: partErr } = await supabase
      .from('participations')
      .select('id, hours, deleted_at')
      .eq('id', participationId)
      .maybeSingle()

    if (partErr || !part) {
      return new Response(JSON.stringify({ error: 'Participation introuvable' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (part.deleted_at) {
      return new Response(JSON.stringify({ error: 'Participation déjà supprimée' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error: updateErr } = await supabase
      .from('participations')
      .update({
        deleted_at: now,
        deleted_by: userId,
        deletion_reason: reason.trim(),
        updated_at: now,
      })
      .eq('id', participationId)

    if (updateErr) {
      return new Response(JSON.stringify({ error: 'Erreur lors de la suppression' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await supabase.from('audit_logs').insert({
      actor_user_id: userId,
      action: 'delete_participation',
      entity_type: 'participation',
      entity_id: participationId,
      reason: reason.trim(),
      before_data: { hours: Number(part.hours) },
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
