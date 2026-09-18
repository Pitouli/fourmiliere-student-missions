import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const HMAC_KEY = Deno.env.get('CODE_HMAC_KEY') || 'benebloc-hmac-secret-key-2026'

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

async function hmacSha256Hex(message: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', keyData, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Simple hash for storage (not as strong as bcrypt but works in Deno without deps)
async function sha256Hex(message: string): Promise<string> {
  const enc = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(message + HMAC_KEY))
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const API_BASE = 'https://api.lafourmiliere-benevolat.fr'

async function verifyOrganisationExists(externalId: string): Promise<{ name: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/organisations`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.organisations) return null
    const org = (data.organisations as { id: number; name: string }[]).find((o) => String(o.id) === String(externalId))
    return org ? { name: org.name } : null
  } catch {
    return null
  }
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

    const { externalId, code, name } = await req.json()

    if (!externalId || typeof externalId !== 'string') {
      return new Response(JSON.stringify({ error: 'Organisation manquante' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!code || !/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: 'Le code doit contenir exactement 6 chiffres' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify organisation exists in public API
    const orgInfo = await verifyOrganisationExists(externalId)
    if (!orgInfo) {
      return new Response(JSON.stringify({ error: 'Organisation introuvable dans le référentiel public' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const orgName = name || orgInfo.name
    const codeHmac = await hmacSha256Hex(code, HMAC_KEY)
    const codeHash = await sha256Hex(code)

    // Check code uniqueness (HMAC)
    const { data: existingCode } = await supabase
      .from('organization_credentials')
      .select('id, external_id')
      .eq('code_hmac', codeHmac)
      .maybeSingle()

    if (existingCode && existingCode.external_id !== String(externalId)) {
      return new Response(JSON.stringify({ error: 'Ce code est déjà attribué à une autre organisation' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Upsert organization credential
    const now = new Date().toISOString()
    const { data: existing, error: queryErr } = await supabase
      .from('organization_credentials')
      .select('id, code_hash')
      .eq('external_id', String(externalId))
      .maybeSingle()

    if (queryErr) {
      return new Response(JSON.stringify({ error: 'Erreur serveur' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let action = 'create'
    let entityId: string | null = null

    if (existing) {
      // Update existing
      action = 'update'
      entityId = existing.id
      const beforeData = { code_hash: existing.code_hash }
      const { error: updateErr } = await supabase
        .from('organization_credentials')
        .update({
          name: orgName,
          code_hash: codeHash,
          code_hmac: codeHmac,
          code_last_changed_at: now,
          updated_by: userId,
          updated_at: now,
        })
        .eq('id', existing.id)

      if (updateErr) {
        if (updateErr.code === '23505') {
          return new Response(JSON.stringify({ error: 'Ce code est déjà attribué à une autre organisation' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ error: 'Erreur lors de la mise à jour' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      await supabase.from('audit_logs').insert({
        actor_user_id: userId,
        action: 'update_organization_code',
        entity_type: 'organization_credential',
        entity_id: existing.id,
        reason: `Modification du code pour ${orgName}`,
        before_data: beforeData,
      })
    } else {
      // Create new
      const { data: newCred, error: insertErr } = await supabase
        .from('organization_credentials')
        .insert({
          external_id: String(externalId),
          name: orgName,
          code_hash: codeHash,
          code_hmac: codeHmac,
          code_last_changed_at: now,
          is_active: true,
          created_by: userId,
          updated_by: userId,
        })
        .select('id')
        .single()

      if (insertErr) {
        if (insertErr.code === '23505') {
          return new Response(JSON.stringify({ error: 'Ce code est déjà attribué à une autre organisation' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ error: 'Erreur lors de la création' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      entityId = newCred.id
      await supabase.from('audit_logs').insert({
        actor_user_id: userId,
        action: 'create_organization_code',
        entity_type: 'organization_credential',
        entity_id: newCred.id,
        reason: `Création du code pour ${orgName}`,
      })
    }

    return new Response(JSON.stringify({ success: true, action, id: entityId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
