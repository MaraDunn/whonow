-- Add optional subject support for Outreach Assistant templates.
ALTER TABLE public.message_templates
ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.message_templates.subject IS 'Template subject text, may contain {{first_name}} etc. variables.';
