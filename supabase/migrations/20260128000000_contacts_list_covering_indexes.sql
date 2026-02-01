-- Covering indexes for list_contacts_slim: enable index-only scans so the list
-- never has to touch the heap. Matches the exact columns returned by the slim RPC.
-- Key order supports both filter and keyset: (created_at DESC, id DESC).

-- Owned contacts: filter by owner_id, order by created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_contacts_list_owned_covering
  ON public.contacts (
    owner_id,
    created_at DESC NULLS LAST,
    id DESC NULLS LAST
  )
  INCLUDE (name, email, phone, company, role, avatar, folder_id, tags, is_shared, last_contacted_at, is_client, company_id)
  WHERE deleted_at IS NULL AND owner_id IS NOT NULL;

-- Shared contacts: filter by company_id + is_shared, order by created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_contacts_list_shared_covering
  ON public.contacts (
    company_id,
    is_shared,
    created_at DESC NULLS LAST,
    id DESC NULLS LAST
  )
  INCLUDE (name, email, phone, company, role, avatar, folder_id, tags, owner_id, last_contacted_at, is_client)
  WHERE deleted_at IS NULL AND is_shared = true AND company_id IS NOT NULL;
