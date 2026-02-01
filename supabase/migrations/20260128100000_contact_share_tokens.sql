-- Contact share tokens: short-lived tokens for "Add to WhoNow" and "Download CSV" from Slack.
-- Token is created when a contact is shared to Slack; resolved by contact-share edge function.
CREATE TABLE IF NOT EXISTS contact_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  contact_payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_share_tokens_token ON contact_share_tokens (token);
CREATE INDEX IF NOT EXISTS idx_contact_share_tokens_expires_at ON contact_share_tokens (expires_at);

-- Allow service role / edge functions to manage tokens (no RLS for anonymous read by token).
ALTER TABLE contact_share_tokens ENABLE ROW LEVEL SECURITY;

-- Only backend (service role) can insert/select/delete; no direct anon/user access.
CREATE POLICY "Service role only for contact_share_tokens"
  ON contact_share_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE contact_share_tokens IS 'Short-lived tokens for shared contact links (Slack Add to WhoNow / Download CSV). Resolved by contact-share edge function using service role.';
