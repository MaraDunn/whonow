-- Composite indexes for scaled contacts list/count queries
-- Enables index scans instead of full table scans for "list my contacts" and "count my contacts"

-- Main list (owner path): "my" contacts, non-deleted, ordered by newest
CREATE INDEX IF NOT EXISTS idx_contacts_owner_deleted_created
  ON public.contacts (owner_id, deleted_at, created_at DESC NULLS LAST)
  WHERE deleted_at IS NULL AND owner_id IS NOT NULL;

-- Main list (company shared path): shared company contacts, non-deleted, ordered
CREATE INDEX IF NOT EXISTS idx_contacts_company_shared_deleted_created
  ON public.contacts (company_id, is_shared, deleted_at, created_at DESC NULLS LAST)
  WHERE deleted_at IS NULL AND is_shared = true AND company_id IS NOT NULL;

-- Support folder-filtered list/count
CREATE INDEX IF NOT EXISTS idx_contacts_folder_deleted_created
  ON public.contacts (folder_id, deleted_at, created_at DESC NULLS LAST)
  WHERE deleted_at IS NULL AND folder_id IS NOT NULL;

-- Support client-directory list
CREATE INDEX IF NOT EXISTS idx_contacts_is_client_owner_created
  ON public.contacts (owner_id, is_client, deleted_at, created_at DESC NULLS LAST)
  WHERE deleted_at IS NULL AND is_client = true AND owner_id IS NOT NULL;
