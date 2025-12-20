-- Add deleted_at column for soft delete
ALTER TABLE public.contacts 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Add index for efficient filtering
CREATE INDEX idx_contacts_deleted_at ON public.contacts(deleted_at);