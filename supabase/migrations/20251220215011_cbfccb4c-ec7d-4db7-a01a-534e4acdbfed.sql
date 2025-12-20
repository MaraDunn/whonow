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