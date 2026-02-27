-- Add a global default contact interval (in days) to user profiles.
-- This is used as the default preferred_contact_interval_days when creating/editing client contacts.
-- Default: 30 days. Users can change this in the Client Dashboard Overview.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_contact_interval integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.profiles.default_contact_interval IS 'Global default contact interval in days. Used as the default preferred_contact_interval_days for client contacts that have not had a custom interval set.';
