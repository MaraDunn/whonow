-- Add a column to track if user has completed the company setup choice
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_completed_company_setup boolean DEFAULT false;

-- Update existing profiles that already have a company to mark them as completed
UPDATE public.profiles 
SET has_completed_company_setup = true 
WHERE company_id IS NOT NULL;