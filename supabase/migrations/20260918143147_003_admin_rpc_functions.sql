/*
# Admin RPC functions

Adds the RPC functions used by the admin-list-participations, admin-audit-logs
and admin-export-participations edge functions. These were missing from the
initial schema, causing "Erreur lors de la récupération" on the
"Suivi des étudiants" and "Journal d'audit" admin pages, and on CSV export.

## New Functions
1. admin_get_participations() — returns all participations joined with student emails, event names, and organization names. Used by admin tracking page and CSV export.
2. admin_get_audit_logs(limit_count) — returns recent audit log entries. Used by the audit journal page.

Both functions are SECURITY DEFINER and STABLE so they run with service-role privileges from the edge functions.
*/

CREATE OR REPLACE FUNCTION admin_get_participations()
RETURNS TABLE (
  id uuid,
  student_id uuid,
  student_email citext,
  event_id uuid,
  event_name text,
  event_external_id text,
  organization_id uuid,
  organization_name text,
  hours numeric,
  max_hours_at_validation numeric,
  source text,
  validated_at timestamptz,
  created_by_admin_id uuid,
  admin_reason text,
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    p.student_id,
    sp.email AS student_email,
    p.event_id,
    er.name AS event_name,
    er.external_id AS event_external_id,
    p.organization_id,
    oc.name AS organization_name,
    p.hours,
    p.max_hours_at_validation,
    p.source,
    p.validated_at,
    p.created_by_admin_id,
    p.admin_reason,
    p.deleted_at,
    p.deleted_by,
    p.deletion_reason,
    p.created_at,
    p.updated_at
  FROM participations p
  JOIN student_profiles sp ON sp.id = p.student_id
  JOIN event_references er ON er.id = p.event_id
  LEFT JOIN organization_credentials oc ON oc.id = p.organization_id
  ORDER BY p.validated_at DESC;
$$;

CREATE OR REPLACE FUNCTION admin_get_audit_logs(limit_count integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    al.id,
    al.actor_user_id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.reason,
    al.before_data,
    al.after_data,
    al.request_id,
    al.created_at
  FROM audit_logs al
  ORDER BY al.created_at DESC
  LIMIT limit_count;
$$;
