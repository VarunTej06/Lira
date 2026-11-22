-- Repeating stand-ups, and the Google account an organisation connects so the app can make the Meet link and send the emails.

-- A repeat names the rule, the last day, and the time zone the clock time belongs to (so 10:00 stays 10:00 across a clock change).
ALTER TABLE standup_calls
  ADD COLUMN repeat       text NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','daily','weekdays','weekly')),
  ADD COLUMN repeat_until date,
  ADD COLUMN time_zone    text NOT NULL DEFAULT 'UTC' CHECK (length(time_zone) BETWEEN 1 AND 64),
  ADD COLUMN link_source  text NOT NULL DEFAULT 'pasted' CHECK (link_source IN ('pasted','meet')),
  ADD CONSTRAINT standup_repeat_needs_end CHECK ((repeat = 'none') = (repeat_until IS NULL));

-- One connected Google account per organisation. Only the refresh token is kept, encrypted by the API (AES-256-GCM) with a key
-- that lives in the secret store, never in this database.
CREATE TABLE google_connections (
  org_id        uuid PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  google_email  text NOT NULL CHECK (length(google_email) BETWEEN 3 AND 254),
  refresh_token text NOT NULL,
  connected_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  connected_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON google_connections TO lira_app;
