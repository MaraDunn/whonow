-- Append-only activity log table for per-contact event history.
-- Entries are never updated or deleted (enforced by RLS + no UPDATE/DELETE policies).
-- activity_type values: 'client_toggled', 'contacted', 'follow_up_set', 'note_added', 'internal_toggled'

CREATE TABLE IF NOT EXISTS public.activity_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_type text      NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching all activity for a given contact, newest-first
CREATE INDEX IF NOT EXISTS idx_activity_log_contact_id
  ON public.activity_log(contact_id, created_at DESC);

-- Index for time-range queries across the activity log
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON public.activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Matches the open RLS pattern used by the contacts table
CREATE POLICY "Allow authenticated read access"
  ON public.activity_log
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert access"
  ON public.activity_log
  FOR INSERT
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;

-- No UPDATE or DELETE policies — this table is append-only by design

COMMENT ON TABLE public.activity_log IS 'Append-only log of contact activity events. Never updated or deleted.';
COMMENT ON COLUMN public.activity_log.activity_type IS 'One of: client_toggled, contacted, follow_up_set, note_added, internal_toggled';
COMMENT ON COLUMN public.activity_log.metadata IS 'JSON payload specific to the activity_type (e.g., { "is_client": true })';
