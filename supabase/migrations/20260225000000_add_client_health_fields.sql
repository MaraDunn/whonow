-- Add relationship health fields to contacts table
-- These are used for the deterministic Relationship Health Score (clients only).
-- preferred_contact_interval_days: how often the user aims to contact this client (default 30)
-- client_weight: multiplier for the health score (default 1.0)

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS preferred_contact_interval_days integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_weight numeric(5,2) DEFAULT NULL;

-- Ensure interval is positive and within reasonable bounds when set
ALTER TABLE contacts
  ADD CONSTRAINT check_preferred_interval
    CHECK (preferred_contact_interval_days IS NULL OR (preferred_contact_interval_days >= 1 AND preferred_contact_interval_days <= 365));

ALTER TABLE contacts
  ADD CONSTRAINT check_client_weight
    CHECK (client_weight IS NULL OR client_weight > 0);

COMMENT ON COLUMN contacts.preferred_contact_interval_days IS 'Days between preferred contacts; used by Relationship Health Score. Defaults to 30 when NULL.';
COMMENT ON COLUMN contacts.client_weight IS 'Multiplier for Relationship Health Score; defaults to 1.0 when NULL. Only meaningful for is_client = true rows.';
