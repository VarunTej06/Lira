-- The app's settings-style data (projects, roadmaps, sprint goals, teams, stand-ups, dashboards, preferences), kept on the server.
-- Each entry is one key with its value as text, the way the app already holds it. owner_id is null for data shared with the whole
-- organisation, and the person's id for their own preferences. AI keys are never stored here (the API refuses those keys).

CREATE TABLE kv_entries (
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  owner_id   uuid REFERENCES users(id) ON DELETE CASCADE,
  key        text NOT NULL CHECK (key ~ '^lira_[A-Za-z0-9_:.-]{1,120}$' AND key !~ '^lira__' AND key !~* 'api_key'),
  value      text NOT NULL CHECK (length(value) <= 262144),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX kv_shared ON kv_entries (org_id, key) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX kv_personal ON kv_entries (org_id, owner_id, key) WHERE owner_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON kv_entries TO lira_app;
