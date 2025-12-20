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