-- Add a global relationship reminder interval (in days) to user profiles.
-- Default: 30 days. Users can change this in the Client Dashboard settings.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_reminder_interval integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.profiles.default_reminder_interval IS 'Global relationship reminder interval in days. Contacts not contacted within this period appear in Relationship Reminders.';
