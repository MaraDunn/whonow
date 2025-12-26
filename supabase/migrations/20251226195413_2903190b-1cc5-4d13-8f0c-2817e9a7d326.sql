-- Add is_client field to contacts table for filtering client directory
ALTER TABLE public.contacts 
ADD COLUMN is_client BOOLEAN DEFAULT false;