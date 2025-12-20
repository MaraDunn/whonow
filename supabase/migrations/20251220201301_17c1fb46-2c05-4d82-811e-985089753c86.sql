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