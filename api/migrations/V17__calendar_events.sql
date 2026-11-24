-- Google Calendar events for calls. The connection remembers which permissions Google granted, so an organisation that connected before the
-- Calendar permission existed keeps working and is asked once more. A call remembers its event in the owner's calendar.
ALTER TABLE google_connections ADD COLUMN scopes text NOT NULL DEFAULT '';
ALTER TABLE standup_calls ADD COLUMN calendar_event_id text CHECK (length(calendar_event_id) <= 200);
