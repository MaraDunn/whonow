-- Add last_contacted_at field to contacts table for tracking when contacts were last reached out to
ALTER TABLE public.contacts 
ADD COLUMN last_contacted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;