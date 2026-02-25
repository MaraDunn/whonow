-- User-owned message templates for the Outreach Assistant.
-- Each row belongs to a single user (owner_id); RLS enforces isolation.

CREATE TABLE IF NOT EXISTS public.message_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  body        text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Fetch all templates for a user, newest-first
CREATE INDEX IF NOT EXISTS idx_message_templates_owner_id
  ON public.message_templates(owner_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see their own templates
CREATE POLICY "Users can manage their own message templates"
  ON public.message_templates
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;

COMMENT ON TABLE  public.message_templates IS 'Saved outreach message templates, scoped per user.';
COMMENT ON COLUMN public.message_templates.name IS 'User-visible label for the template (e.g. "Cold outreach").';
COMMENT ON COLUMN public.message_templates.body IS 'Template body text, may contain {{first_name}} etc. variables.';
