-- Links sent by email: confirm an address, and choose a new password. Only a hash of each link's token is stored, so a copy of this
-- table cannot be used to confirm an address or take over an account. A token works once (used_at) and until it expires.
CREATE TABLE email_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('verify', 'reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_kind ON email_tokens (user_id, kind, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON email_tokens TO lira_app;  -- DELETE: clearing old links as we go
