-- Migration: Add Business Fields to Contacts
-- This migration adds business_name and business_type fields to support business lookup at addresses

-- Add business fields to contacts table
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT;

-- Add index for faster business name searches
CREATE INDEX IF NOT EXISTS idx_contacts_business_name 
  ON public.contacts(business_name) 
  WHERE business_name IS NOT NULL;

