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

function escapeCsv(value: string, separator: string): string {
  if (value.includes(separator) || value.includes('"') || value.includes('\n') || value.includes(';')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
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
    const separator = url.searchParams.get('separator') === 'comma' ? ',' : ';'

    const { data, error } = await supabase.rpc('admin_get_participations')

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Erreur lors de la récupération' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Filter to active (non-deleted) participations
    const active = (data as { student_email: string; event_name: string; hours: number; deleted_at: string | null }[])
      .filter((p) => !p.deleted_at)

    // Build matrix: rows = events, columns = students
    const eventNames = [...new Set(active.map((p) => p.event_name))].sort()
    const studentEmails = [...new Set(active.map((p) => p.student_email))].sort()

    // Build lookup map
    const lookup = new Map<string, number>()
    for (const p of active) {
      const key = `${p.event_name}\0${p.student_email}`
      lookup.set(key, Number(p.hours))
    }

    // Build CSV
    const header = ['event', ...studentEmails].map((v) => escapeCsv(v, separator))
    const lines = [header.join(separator)]

    for (const eventName of eventNames) {
      const row = [escapeCsv(eventName, separator)]
      for (const email of studentEmails) {
        const hours = lookup.get(`${eventName}\0${email}`)
        row.push(hours !== undefined ? String(hours) : '')
      }
      lines.push(row.join(separator))
    }

    const csv = '\uFEFF' + lines.join('\r\n')

    // Audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: userId,
      action: 'export_csv',
      entity_type: 'export',
      reason: `Export CSV (${active.length} participations, ${studentEmails.length} étudiants, ${eventNames.length} événements)`,
    })

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="export_participations_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
