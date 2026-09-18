/*
# Initial schema for Bénébloc validation app

## Overview
Creates the full database schema for the student volunteer event validation application.
Students identify by email (no password), organizations validate events on the student's phone
via a secret 6-digit code, and administrators track/export/manage participations.

## New Tables
1. student_profiles — Students identified by normalized email
2. event_references — Local cache of events from public API
3. organization_credentials — Organizations configured with a secret code
4. validation_requests — Temporary validation requests
5. participations — Validated event participations
6. admin_profiles — Administrator accounts
7. audit_logs — Audit trail for admin operations

## Views
- active_participations — participations WHERE deleted_at IS NULL
- participations_with_details — joins participations with student email, event name, organization name

## Security (RLS)
- student_profiles: public read
- event_references: public read
- organization_credentials: admin-only read
- validation_requests: no direct access (edge functions only)
- participations: public read (filtering done in app/edge functions)
- admin_profiles: authenticated read
- audit_logs: admin-only read

## Important Notes
1. All sensitive writes go through edge functions using the service role key
2. Students identify by email stored in localStorage — no Supabase Auth
3. Admins use Supabase Auth + admin_profiles for role-based access
4. Organization codes stored as bcrypt hashes + HMAC for uniqueness
5. Soft deletes on participations preserve audit trail
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ admin_profiles (created first — referenced by other policies) ============
CREATE TABLE IF NOT EXISTS admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_admin_profiles" ON admin_profiles;
CREATE POLICY "read_admin_profiles" ON admin_profiles FOR SELECT
  TO authenticated USING (true);

-- ============ student_profiles ============
CREATE TABLE IF NOT EXISTS student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email citext NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_student_by_email" ON student_profiles;
CREATE POLICY "read_student_by_email" ON student_profiles FOR SELECT
  TO anon, authenticated USING (true);

-- ============ event_references ============
CREATE TABLE IF NOT EXISTS event_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  name text NOT NULL,
  max_hours numeric(6,2) NOT NULL CHECK (max_hours >= 0),
  is_active boolean NOT NULL DEFAULT true,
  source_payload jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_event_references" ON event_references;
CREATE POLICY "read_event_references" ON event_references FOR SELECT
  TO anon, authenticated USING (true);

-- ============ organization_credentials ============
CREATE TABLE IF NOT EXISTS organization_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  name text NOT NULL,
  code_hash text NOT NULL UNIQUE,
  code_hmac text NOT NULL UNIQUE,
  code_last_changed_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organization_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_org_creds_admin" ON organization_credentials;
CREATE POLICY "read_org_creds_admin" ON organization_credentials FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE admin_profiles.user_id = auth.uid() AND admin_profiles.is_active = true)
  );

-- ============ validation_requests ============
CREATE TABLE IF NOT EXISTS validation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES event_references(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'validated', 'expired', 'cancelled')) DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE validation_requests ENABLE ROW LEVEL SECURITY;
-- No policies = no direct access from anon/authenticated

CREATE INDEX IF NOT EXISTS idx_validation_requests_lookup
  ON validation_requests (student_id, event_id, status);

-- ============ participations ============
CREATE TABLE IF NOT EXISTS participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES event_references(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organization_credentials(id) ON DELETE SET NULL,
  validation_request_id uuid UNIQUE REFERENCES validation_requests(id) ON DELETE SET NULL,
  hours numeric(6,2) NOT NULL CHECK (hours >= 0),
  max_hours_at_validation numeric(6,2) NOT NULL CHECK (max_hours_at_validation >= 0),
  source text NOT NULL CHECK (source IN ('organization', 'admin')),
  validated_at timestamptz NOT NULL DEFAULT now(),
  created_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_reason text,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deletion_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_participations" ON participations;
CREATE POLICY "read_participations" ON participations FOR SELECT
  TO anon, authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_participation_student_event
  ON participations (student_id, event_id)
  WHERE deleted_at IS NULL;

ALTER TABLE participations DROP CONSTRAINT IF EXISTS chk_participation_hours;
ALTER TABLE participations
  ADD CONSTRAINT chk_participation_hours
  CHECK (hours >= 0 AND hours <= max_hours_at_validation);

-- ============ audit_logs ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_audit_logs_admin" ON audit_logs;
CREATE POLICY "read_audit_logs_admin" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE admin_profiles.user_id = auth.uid() AND admin_profiles.is_active = true)
  );

-- ============ Views ============
CREATE OR REPLACE VIEW active_participations AS
SELECT * FROM participations WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW participations_with_details AS
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
LEFT JOIN organization_credentials oc ON oc.id = p.organization_id;

-- ============ Functions ============

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = auth.uid()
    AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION upsert_student_by_email(p_email citext)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO student_profiles (email)
  VALUES (p_email)
  ON CONFLICT (email) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_participations_by_email(p_email citext)
RETURNS TABLE (
  id uuid,
  student_id uuid,
  event_id uuid,
  event_name text,
  event_external_id text,
  organization_id uuid,
  organization_name text,
  hours numeric,
  max_hours_at_validation numeric,
  source text,
  validated_at timestamptz,
  deleted_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    p.student_id,
    p.event_id,
    er.name AS event_name,
    er.external_id AS event_external_id,
    p.organization_id,
    oc.name AS organization_name,
    p.hours,
    p.max_hours_at_validation,
    p.source,
    p.validated_at,
    p.deleted_at
  FROM participations p
  JOIN student_profiles sp ON sp.id = p.student_id
  JOIN event_references er ON er.id = p.event_id
  LEFT JOIN organization_credentials oc ON oc.id = p.organization_id
  WHERE sp.email = lower(p_email)
  AND p.deleted_at IS NULL
  ORDER BY p.validated_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_validation_request_details(p_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  student_email citext,
  event_name text,
  event_external_id text,
  event_max_hours numeric,
  expires_at timestamptz,
  validated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    vr.id,
    vr.status,
    sp.email,
    er.name,
    er.external_id,
    er.max_hours,
    vr.expires_at,
    vr.validated_at
  FROM validation_requests vr
  JOIN student_profiles sp ON sp.id = vr.student_id
  JOIN event_references er ON er.id = vr.event_id
  WHERE vr.id = p_id;
$$;
