-- ============================================
-- Combined Supabase Migrations
-- ============================================
-- This file contains all migrations combined in chronological order
-- Generated: 1/3/2026, 9:23:55 AM
-- 
-- Instructions:
-- 1. Copy the entire contents of this file
-- 2. Go to your Supabase Dashboard → SQL Editor
-- 3. Paste and click "Run"
-- ============================================

-- ============================================

-- ============================================
-- Migration 1: 20251219221658_77de93ea-2826-4188-862c-7387d6eba370.sql
-- ============================================

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  role TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- For now, allow public access (no auth required)
-- This can be updated later when authentication is added
CREATE POLICY "Allow public read access" 
ON public.contacts 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access" 
ON public.contacts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access" 
ON public.contacts 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access" 
ON public.contacts 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Migration 2: 20251220033452_56719322-35b7-4846-a471-494f9ae5a783.sql
-- ============================================

-- Create folders table
CREATE TABLE public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS with public access (matching contacts table pattern)
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.folders FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.folders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.folders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.folders FOR DELETE USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add folder reference to contacts table
ALTER TABLE public.contacts ADD COLUMN folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

-- ============================================
-- Migration 3: 20251220035023_2855f25a-d105-44b8-ace2-adee9145fef4.sql
-- ============================================

-- Add deleted_at column for soft delete
ALTER TABLE public.contacts 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Add index for efficient filtering
CREATE INDEX idx_contacts_deleted_at ON public.contacts(deleted_at);

-- ============================================
-- Migration 4: 20251220201301_17c1fb46-2c05-4d82-811e-985089753c86.sql
-- ============================================

-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  avatar_url TEXT,
  description TEXT,
  is_visible_in_directory BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Add columns to contacts table
ALTER TABLE public.contacts 
  ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN is_shared BOOLEAN DEFAULT false;

-- Add columns to folders table
ALTER TABLE public.folders 
  ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Security definer function to get user's company ID
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at on companies
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for companies
CREATE POLICY "Users can view their own company"
  ON public.companies FOR SELECT
  USING (id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company if admin"
  ON public.companies FOR UPDATE
  USING (id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their company"
  ON public.profiles FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()) OR id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles in their company"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS Policies for contacts
DROP POLICY IF EXISTS "Allow public read access" ON public.contacts;
DROP POLICY IF EXISTS "Allow public insert access" ON public.contacts;
DROP POLICY IF EXISTS "Allow public update access" ON public.contacts;
DROP POLICY IF EXISTS "Allow public delete access" ON public.contacts;

CREATE POLICY "Users can view their own and shared company contacts"
  ON public.contacts FOR SELECT
  USING (
    owner_id = auth.uid() 
    OR (company_id = public.get_user_company_id(auth.uid()) AND is_shared = true)
    OR (company_id IS NULL AND owner_id IS NULL) -- Legacy data
  );

CREATE POLICY "Users can create contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (owner_id = auth.uid() OR owner_id IS NULL)
  );

CREATE POLICY "Users can update their own contacts or shared if admin"
  ON public.contacts FOR UPDATE
  USING (
    owner_id = auth.uid() 
    OR (is_shared = true AND company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Users can delete their own contacts or shared if admin"
  ON public.contacts FOR DELETE
  USING (
    owner_id = auth.uid() 
    OR (is_shared = true AND company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  );

-- Update RLS Policies for folders
DROP POLICY IF EXISTS "Allow public read access" ON public.folders;
DROP POLICY IF EXISTS "Allow public insert access" ON public.folders;
DROP POLICY IF EXISTS "Allow public update access" ON public.folders;
DROP POLICY IF EXISTS "Allow public delete access" ON public.folders;

CREATE POLICY "Users can view their own and company folders"
  ON public.folders FOR SELECT
  USING (
    owner_id = auth.uid() 
    OR (company_id = public.get_user_company_id(auth.uid()) AND owner_id IS NULL)
    OR (company_id IS NULL AND owner_id IS NULL) -- Legacy data
  );

CREATE POLICY "Users can create folders"
  ON public.folders FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (owner_id = auth.uid() OR owner_id IS NULL)
  );

CREATE POLICY "Users can update their own folders or company folders if admin"
  ON public.folders FOR UPDATE
  USING (
    owner_id = auth.uid() 
    OR (owner_id IS NULL AND company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Users can delete their own folders or company folders if admin"
  ON public.folders FOR DELETE
  USING (
    owner_id = auth.uid() 
    OR (owner_id IS NULL AND company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  );

-- ============================================
-- Migration 5: 20251220202858_743187da-2701-4088-86d7-ba38aadaa73a.sql
-- ============================================

-- Ensure we can safely do idempotent role inserts
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_uidx
ON public.user_roles (user_id, role);

-- Prevent users from changing their company_id directly (company membership should be managed server-side)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND company_id = public.get_user_company_id(auth.uid())
);

-- Scope role management to members of the same company
DROP POLICY IF EXISTS "Admins can manage roles in their company" ON public.user_roles;
CREATE POLICY "Admins can manage roles in their company"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.get_user_company_id(user_id) = public.get_user_company_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.get_user_company_id(user_id) = public.get_user_company_id(auth.uid())
);

-- Create company + assign the current user as admin (atomic)
CREATE OR REPLACE FUNCTION public.create_company(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'company_name_required';
  END IF;

  -- Ensure a profile exists
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;

  IF public.get_user_company_id(auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'already_in_company';
  END IF;

  INSERT INTO public.companies (name)
  VALUES (p_name)
  RETURNING id INTO v_company_id;

  UPDATE public.profiles
  SET company_id = v_company_id
  WHERE id = auth.uid();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_company_id;
END;
$$;

-- Join a company via invite code + assign member role (atomic)
CREATE OR REPLACE FUNCTION public.join_company(p_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_invite_code IS NULL OR btrim(p_invite_code) = '' THEN
    RAISE EXCEPTION 'invite_code_required';
  END IF;

  -- Ensure a profile exists
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;

  IF public.get_user_company_id(auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'already_in_company';
  END IF;

  SELECT c.id
  INTO v_company_id
  FROM public.companies c
  WHERE c.invite_code = lower(btrim(p_invite_code))
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;

  UPDATE public.profiles
  SET company_id = v_company_id
  WHERE id = auth.uid();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'member'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_company(text) TO authenticated;


-- ============================================
-- Migration 6: 20251220214224_ade82030-024e-47f5-b1a8-7b5b8ef5bf3b.sql
-- ============================================

-- Add a column to track if user has completed the company setup choice
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_completed_company_setup boolean DEFAULT false;

-- Update existing profiles that already have a company to mark them as completed
UPDATE public.profiles 
SET has_completed_company_setup = true 
WHERE company_id IS NOT NULL;

-- ============================================
-- Migration 7: 20251220214652_6db44657-27fb-4ef2-b7a1-f1f4d683620c.sql
-- ============================================

-- Drop the existing update policy that's too restrictive
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a new update policy that allows users to update their own profile
-- They can update any field except company_id (which should only be set by RPC functions)
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() 
  AND (
    -- Either company_id is not changing
    company_id IS NOT DISTINCT FROM (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- ============================================
-- Migration 8: 20251220215011_cbfccb4c-ec7d-4db7-a01a-534e4acdbfed.sql
-- ============================================

-- Create a table for company-level preset keywords
CREATE TABLE public.company_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, keyword)
);

-- Enable RLS
ALTER TABLE public.company_keywords ENABLE ROW LEVEL SECURITY;

-- Users can view keywords for their company
CREATE POLICY "Users can view their company keywords"
ON public.company_keywords
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

-- Only admins can manage company keywords
CREATE POLICY "Admins can insert company keywords"
ON public.company_keywords
FOR INSERT
WITH CHECK (
  company_id = get_user_company_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete company keywords"
ON public.company_keywords
FOR DELETE
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================
-- Migration 9: 20251224025152_dbf990b6-ec9f-4ede-ad06-64699902221b.sql
-- ============================================

-- Create integrations table to store user integration settings
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'outlook')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  webhook_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own integrations"
  ON public.integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
  ON public.integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
  ON public.integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
  ON public.integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create integration_logs table for tracking sync activities
CREATE TABLE public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy for logs
CREATE POLICY "Users can view logs for their integrations"
  ON public.integration_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.integrations
      WHERE integrations.id = integration_logs.integration_id
      AND integrations.user_id = auth.uid()
    )
  );

-- ============================================
-- Migration 10: 20251225024240_faba7b6e-dbea-4432-b414-b0fe0c3887bf.sql
-- ============================================

-- Drop existing SELECT policy that allows orphan contacts to be visible
DROP POLICY IF EXISTS "Users can view their own and shared company contacts" ON contacts;

-- Create new stricter policy - only own contacts or shared company contacts
CREATE POLICY "Users can view their own and shared company contacts" ON contacts
  FOR SELECT USING (
    (owner_id = auth.uid()) OR 
    ((company_id = get_user_company_id(auth.uid())) AND (is_shared = true))
  );

-- Also fix folders table which has the same issue
DROP POLICY IF EXISTS "Users can view their own and company folders" ON folders;

CREATE POLICY "Users can view their own and company folders" ON folders
  FOR SELECT USING (
    (owner_id = auth.uid()) OR 
    ((company_id = get_user_company_id(auth.uid())) AND (owner_id IS NULL))
  );

-- ============================================
-- Migration 11: 20251226011350_405ca796-61c4-4017-acdd-eb7a2d2ea957.sql
-- ============================================

-- Drop the existing constraint
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;

-- Add the new constraint with 'teams' included
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check 
  CHECK ((provider = ANY (ARRAY['slack'::text, 'outlook'::text, 'teams'::text])));

-- ============================================
-- Migration 12: 20251226194244_81fa7a7b-76e9-4738-b992-97f3f695f751.sql
-- ============================================

-- Add last_contacted_at field to contacts table for tracking when contacts were last reached out to
ALTER TABLE public.contacts 
ADD COLUMN last_contacted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- ============================================
-- Migration 13: 20251226195413_2903190b-1cc5-4d13-8f0c-2817e9a7d326.sql
-- ============================================

-- Add is_client field to contacts table for filtering client directory
ALTER TABLE public.contacts 
ADD COLUMN is_client BOOLEAN DEFAULT false;

-- ============================================
-- Migration 14: 20251228201424_b3b0772b-840f-49b2-a5ba-c409591c06c5.sql
-- ============================================

-- Create subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM (
  'starter', 'pro', 'team', 'business', 'enterprise', 'global_enterprise'
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tier subscription_tier NOT NULL DEFAULT 'starter',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  employee_seats_used INTEGER DEFAULT 0,
  employee_seats_limit INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create employee access keys table
CREATE TABLE public.employee_access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_access_keys ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view their own subscription"
ON public.subscriptions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can view company subscription"
ON public.subscriptions FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert their own subscription"
ON public.subscriptions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own subscription"
ON public.subscriptions FOR UPDATE
USING (user_id = auth.uid());

-- Employee access keys policies
CREATE POLICY "Company admins can manage access keys"
ON public.employee_access_keys FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can view their claimed key"
ON public.employee_access_keys FOR SELECT
USING (claimed_by = auth.uid());

CREATE POLICY "Anyone can view unclaimed keys for claiming"
ON public.employee_access_keys FOR SELECT
USING (claimed_by IS NULL AND is_active = true);

-- Function to get user's effective subscription tier
CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(_user_id uuid)
RETURNS subscription_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tier FROM public.subscriptions WHERE user_id = _user_id AND status = 'active'),
    (SELECT s.tier FROM public.subscriptions s 
     JOIN public.employee_access_keys e ON e.subscription_id = s.id 
     WHERE e.claimed_by = _user_id AND e.is_active = true AND s.status = 'active'),
    'starter'::subscription_tier
  )
$$;

-- Function to get available seats for a company subscription
CREATE OR REPLACE FUNCTION public.get_available_employee_seats(_company_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT employee_seats_limit - employee_seats_used 
     FROM public.subscriptions 
     WHERE company_id = _company_id AND status = 'active'),
    0
  )
$$;

-- Function to claim an employee access key
CREATE OR REPLACE FUNCTION public.claim_employee_access_key(_access_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id uuid;
  v_subscription_id uuid;
  v_company_id uuid;
  v_seats_available integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Find the key
  SELECT id, subscription_id, company_id INTO v_key_id, v_subscription_id, v_company_id
  FROM public.employee_access_keys
  WHERE access_key = _access_key AND claimed_by IS NULL AND is_active = true;

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_claimed_key';
  END IF;

  -- Check seats available
  SELECT get_available_employee_seats(v_company_id) INTO v_seats_available;
  IF v_seats_available <= 0 THEN
    RAISE EXCEPTION 'no_seats_available';
  END IF;

  -- Claim the key
  UPDATE public.employee_access_keys
  SET claimed_by = auth.uid(), claimed_at = now()
  WHERE id = v_key_id;

  -- Update seats used
  UPDATE public.subscriptions
  SET employee_seats_used = employee_seats_used + 1
  WHERE id = v_subscription_id;

  -- Link user to company
  UPDATE public.profiles
  SET company_id = v_company_id
  WHERE id = auth.uid();

  RETURN true;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Migration 15: 20251231002227_901e3077-8570-4a82-b742-7f3ee817f09b.sql
-- ============================================

-- Create audit_logs table for security monitoring
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs for their company members
CREATE POLICY "Admins can view company audit logs" 
  ON public.audit_logs 
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    AND (
      user_id = auth.uid() 
      OR get_user_company_id(user_id) = get_user_company_id(auth.uid())
    )
  );

-- Create index for faster queries
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Function to log audit events (callable from edge functions)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================
-- Migration 16: 20260102041106_ad7535a2-5e77-4645-b67d-36ca9a436411.sql
-- ============================================

-- Add directory_type column to folders table to distinguish folder types
-- 'contacts' = regular contact folders (default)
-- 'clients' = client directory folders
-- 'team' = team/employee directory folders

ALTER TABLE public.folders 
ADD COLUMN directory_type text NOT NULL DEFAULT 'contacts';

-- Add check constraint for valid directory types
ALTER TABLE public.folders 
ADD CONSTRAINT folders_directory_type_check 
CHECK (directory_type IN ('contacts', 'clients', 'team'));

-- Create index for faster filtering by directory type
CREATE INDEX idx_folders_directory_type ON public.folders(directory_type);

-- ============================================
-- End of Migrations
-- ============================================

-- ============================================
-- Migration 20: 20250107200000_add_organization_creation_check.sql
-- ============================================

-- Add function to check if user can create organization (requires team/business tier)
CREATE OR REPLACE FUNCTION public.can_create_organization(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tier IN ('team', 'business', 'enterprise', 'global_enterprise') 
     FROM public.subscriptions 
     WHERE user_id = _user_id AND status = 'active'),
    false
  )
$$;

-- Update create_company function to check subscription tier
CREATE OR REPLACE FUNCTION public.create_company(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'company_name_required';
  END IF;

  -- Check if user has the required subscription tier
  IF NOT public.can_create_organization(auth.uid()) THEN
    RAISE EXCEPTION 'organization_creation_requires_team_or_business_tier'
      USING HINT = 'Upgrade to Team or Business tier to create an organization';
  END IF;

  -- Ensure a profile exists
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;

  IF public.get_user_company_id(auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'already_in_company';
  END IF;

  INSERT INTO public.companies (name)
  VALUES (p_name)
  RETURNING id INTO v_company_id;

  UPDATE public.profiles
  SET company_id = v_company_id
  WHERE id = auth.uid();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_company_id;
END;
$$;

COMMENT ON FUNCTION public.can_create_organization IS 
  'Checks if user has Team or Business tier subscription required for organization creation';

COMMENT ON FUNCTION public.create_company IS 
  'Creates a new organization. Requires Team or Business tier subscription. User becomes admin of the organization.';

-- ============================================
-- End of Migrations
-- ============================================
