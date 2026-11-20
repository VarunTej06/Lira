-- Invitations by email. Only a hash of the link's token is stored; the token is shown once to the person who invited.
CREATE TABLE invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email       text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  role        text NOT NULL CHECK (role IN ('admin','member','viewer','guest')),
  team_id     uuid REFERENCES teams(id) ON DELETE SET NULL,
  token_hash  text NOT NULL UNIQUE,
  invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_org ON invitations (org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON invitations TO lira_app;
