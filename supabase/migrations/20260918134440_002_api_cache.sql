/*
# Add api_cache table for edge function caching

## New Table
- api_cache: stores cached responses from external API calls
  - key (text, PK) — cache key
  - value (jsonb) — cached data
  - expires_at (timestamptz) — when cache entry expires
  - created_at, updated_at (timestamptz)

## Security
- RLS enabled, no policies = service role only (edge functions)
*/

CREATE TABLE IF NOT EXISTS api_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;
