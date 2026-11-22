-- Attachments: one row per file, the bytes live in Blob Storage (ADR-0011). The path is made by the server from ids, never from the file name.
-- A row starts "pending" when the upload address is handed out, and becomes "ready" once the server has seen the file in storage with the declared size.

CREATE TABLE attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_id    bigint NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
  size         bigint NOT NULL CHECK (size BETWEEN 1 AND 26214400),
  content_type text NOT NULL CHECK (length(content_type) BETWEEN 3 AND 100),
  blob_path    text NOT NULL UNIQUE,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_ticket ON attachments (org_id, ticket_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON attachments TO lira_app;
