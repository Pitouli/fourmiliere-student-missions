export interface PublicEvent {
  external_id: string
  name: string
  description: string
  starts_at: string
  ends_at: string
  max_hours: number
  category: { id: number; name: string; emoji: string } | null
  organization: { id: number; name: string; website: string | null } | null
  image_url: string | null
}

export interface PublicOrganisation {
  external_id: string
  name: string
  website: string | null
}

export interface ValidationRequestInfo {
  id: string
  status: string
  student_email: string
  event_name: string
  event_max_hours: number
  event_starts_at: string | null
  event_ends_at: string | null
  event_image_url: string | null
  event_category: { name: string; emoji: string } | null
  expires_at: string
}

export interface Participation {
  id: string
  student_id: string
  event_id: string
  organization_id: string | null
  hours: number
  max_hours_at_validation: number
  source: 'organization' | 'admin'
  validated_at: string
  event_name: string
  event_external_id: string
  organization_name: string | null
  deleted_at: string | null
}

export interface StudentSession {
  email: string
}

export interface AdminParticipationRow {
  id: string
  student_email: string
  event_name: string
  event_external_id: string
  hours: number
  max_hours_at_validation: number
  organization_name: string | null
  source: 'organization' | 'admin'
  validated_at: string
  created_by_admin_id: string | null
  admin_reason: string | null
  deleted_at: string | null
}

export interface OrganizationCredentialRow {
  id: string
  external_id: string
  name: string
  is_active: boolean
  code_last_changed_at: string
  created_at: string
}
