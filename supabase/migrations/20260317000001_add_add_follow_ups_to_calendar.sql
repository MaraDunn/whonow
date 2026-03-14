-- User preference: when Google Calendar is connected, add follow-up reminders as calendar events.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS add_follow_ups_to_calendar boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.add_follow_ups_to_calendar IS 'When true and Google Calendar is connected, follow-up dates are added as all-day events to the user calendar.';
