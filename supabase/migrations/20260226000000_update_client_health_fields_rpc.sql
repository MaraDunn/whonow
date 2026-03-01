-- RPC to update client health fields that may not be in the PostgREST schema cache.
-- Uses SECURITY DEFINER to bypass the schema cache and write directly via SQL.
CREATE OR REPLACE FUNCTION public.update_client_health_fields(
  _contact_id uuid,
  _preferred_contact_interval_days integer,
  _client_weight numeric
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.contacts
  SET
    preferred_contact_interval_days = _preferred_contact_interval_days,
    client_weight                   = _client_weight
  WHERE id = _contact_id
    AND (owner_id = auth.uid() OR is_shared = true);
$$;

GRANT EXECUTE ON FUNCTION public.update_client_health_fields(uuid, integer, numeric) TO authenticated;
