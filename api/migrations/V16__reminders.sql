-- Reminders by email. A person can switch each kind off; with no row everything is on. The ledger says which reminder was sent to whom,
-- so that two copies of the API, or a restart, never send the same one twice: a reminder is claimed by inserting its row.
CREATE TABLE reminder_prefs (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  calls   boolean NOT NULL DEFAULT true,
  due     boolean NOT NULL DEFAULT true
);

CREATE TABLE reminders_sent (
  kind    text NOT NULL CHECK (kind IN ('call', 'due')),
  key     text NOT NULL CHECK (length(key) <= 120),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, key, user_id)
);
CREATE INDEX reminders_sent_at ON reminders_sent (sent_at);

GRANT SELECT, INSERT, UPDATE ON reminder_prefs TO lira_app;
GRANT SELECT, INSERT, DELETE ON reminders_sent TO lira_app;  -- DELETE: a failed send gives its claim back, and old rows are cleared
