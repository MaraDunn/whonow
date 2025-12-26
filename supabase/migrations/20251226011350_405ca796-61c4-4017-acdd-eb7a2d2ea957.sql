-- Drop the existing constraint
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;

-- Add the new constraint with 'teams' included
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check 
  CHECK ((provider = ANY (ARRAY['slack'::text, 'outlook'::text, 'teams'::text])));