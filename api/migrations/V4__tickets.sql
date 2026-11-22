-- Tickets on the server. The fields that are searched, sorted or linked are columns; the rest of the ticket (description, comments,
-- labels, subtasks and so on) is one JSON document, because those fields are only ever read and written with the ticket.
-- Files are not in the document: attachments get a table of their own, with the bytes in Blob Storage (ADR-0011).

ALTER TABLE spaces ADD COLUMN next_ticket_no integer NOT NULL DEFAULT 1;

CREATE TABLE tickets (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  space_id    bigint NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  key         text NOT NULL,
  parent_id   bigint REFERENCES tickets(id) ON DELETE SET NULL,
  epic_id     bigint REFERENCES tickets(id) ON DELETE SET NULL,
  type        text NOT NULL CHECK (type IN ('task','bug','epic','subtask')),
  status      text NOT NULL CHECK (length(status) BETWEEN 1 AND 50),
  priority    text NOT NULL CHECK (priority IN ('highest','high','medium','low','lowest')),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  assignee    text CHECK (length(assignee) <= 100),
  rank        double precision NOT NULL,
  doc         jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(doc) <= 524288),
  version     integer NOT NULL DEFAULT 1,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);
CREATE INDEX tickets_space_status ON tickets (org_id, space_id, status);
CREATE INDEX tickets_parent ON tickets (parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON tickets TO lira_app;
