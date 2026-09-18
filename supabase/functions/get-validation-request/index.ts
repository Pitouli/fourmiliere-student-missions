import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return new Response(JSON.stringify({ error: 'Identifiant de demande manquant' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data, error } = await supabase
      .rpc('get_validation_request_details', { p_id: id })

    if (error || !data || data.length === 0) {
      return new Response(JSON.stringify({ error: 'Demande introuvable' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const req_data = data[0]

    // Check expiry
    let status = req_data.status
    if (status === 'pending' && new Date(req_data.expires_at) < new Date()) {
      await supabase
        .from('validation_requests')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', id)
      status = 'expired'
    }

    return new Response(JSON.stringify({
      id: req_data.id,
      status,
      student_email: req_data.student_email,
      event_name: req_data.event_name,
      event_external_id: req_data.event_external_id,
      event_max_hours: Number(req_data.event_max_hours),
      expires_at: req_data.expires_at,
      validated_at: req_data.validated_at,
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
