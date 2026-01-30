-- Add has_completed_onboarding column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT false;

-- Set existing users to have completed onboarding (so they don't see it)
UPDATE public.profiles
SET has_completed_onboarding = true
WHERE has_completed_onboarding IS NULL OR has_completed_onboarding = false;

-- Set default for new users to false (they should see onboarding)
ALTER TABLE public.profiles
ALTER COLUMN has_completed_onboarding SET DEFAULT false;
