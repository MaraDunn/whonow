-- Add follow-up tracking and reminder interval override to the contacts table.
-- follow_up_date: manual date set by user for when to follow up with a contact
-- reminder_interval_override: per-contact override (in days) for the global reminder interval

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS reminder_interval_override integer;

-- Sparse index: only non-null rows matter for the follow-up queue query
CREATE INDEX IF NOT EXISTS idx_contacts_follow_up_date
  ON public.contacts(follow_up_date)
  WHERE follow_up_date IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.contacts.follow_up_date IS 'Optional date the user wants to follow up with this contact.';
COMMENT ON COLUMN public.contacts.reminder_interval_override IS 'Per-contact override (days) for the global relationship reminder interval. NULL = use global default.';
