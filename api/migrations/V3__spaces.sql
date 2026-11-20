-- Spaces, the first piece of the workspace that lives on the server (ADR-0010, ADR-0005).
-- Every row belongs to one organisation. The id is a number so the app's existing ticket references (spaceId) keep their type.
-- version rises on every change: a write that carries an older version is refused, so two people cannot silently overwrite each other.

CREATE TABLE spaces (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  key         text NOT NULL CHECK (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  icon        text NOT NULL CHECK (length(icon) BETWEEN 1 AND 32),
  color       text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  description text CHECK (length(description) <= 2000),
  version     integer NOT NULL DEFAULT 1,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON spaces TO lira_app;
