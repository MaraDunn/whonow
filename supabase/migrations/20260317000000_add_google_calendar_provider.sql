-- Allow google_calendar as an integrations provider (user-level calendar linking).
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE public.integrations ADD CONSTRAINT integrations_provider_check
  CHECK ((provider = ANY (ARRAY['slack'::text, 'outlook'::text, 'teams'::text, 'google_calendar'::text])));
