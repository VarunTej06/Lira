-- Stand-up calls: a scheduled call with a link (Google Meet or Microsoft Teams), made by an Owner or Admin for a team and/or chosen people.
-- Only people invited (directly or through a team) see a call; Owner and Admin see all of them.

CREATE TABLE standup_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title            text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  starts_at        timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 240),
  link             text NOT NULL CHECK (link ~ '^https://' AND length(link) <= 500),
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX standup_calls_org_time ON standup_calls (org_id, starts_at);

CREATE TABLE standup_invitees (
  call_id      uuid NOT NULL REFERENCES standup_calls(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('user','team')),
  subject_id   uuid NOT NULL,
  PRIMARY KEY (call_id, subject_type, subject_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON standup_calls, standup_invitees TO lira_app;
