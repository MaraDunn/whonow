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