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

    const url = new URL(req.url)
    const toggleId = url.searchParams.get('toggle')

    if (toggleId) {
      // Toggle active status
      const { data: cred } = await supabase
        .from('organization_credentials')
        .select('id, is_active, name')
        .eq('id', toggleId)
        .maybeSingle()

      if (!cred) {
        return new Response(JSON.stringify({ error: 'Organisation introuvable' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const newStatus = !cred.is_active
      await supabase
        .from('organization_credentials')
        .update({ is_active: newStatus, updated_by: userId, updated_at: new Date().toISOString() })
        .eq('id', toggleId)

      await supabase.from('audit_logs').insert({
        actor_user_id: userId,
        action: newStatus ? 'activate_organization' : 'deactivate_organization',
        entity_type: 'organization_credential',
        entity_id: toggleId,
        reason: `${newStatus ? 'Activation' : 'Désactivation'} de ${cred.name}`,
      })
    }

    const { data, error } = await supabase
      .from('organization_credentials')
      .select('id, external_id, name, is_active, code_last_changed_at, created_at')
      .order('name', { ascending: true })

    if (error) {
      return new Response(JSON.stringify({ error: 'Erreur lors de la récupération' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ organizations: data || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
