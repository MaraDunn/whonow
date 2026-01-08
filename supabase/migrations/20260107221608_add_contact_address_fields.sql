-- Migration: Add Address Fields to Contacts
-- This migration adds address fields to the contacts table to support location-based searches

-- Add address fields to contacts table
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add index for location-based searches (using PostGIS would be better for production, but this works for basic searches)
CREATE INDEX IF NOT EXISTS idx_contacts_location 
  ON public.contacts(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add index for city/state searches
CREATE INDEX IF NOT EXISTS idx_contacts_city_state 
  ON public.contacts(city, state) 
  WHERE city IS NOT NULL OR state IS NOT NULL;

