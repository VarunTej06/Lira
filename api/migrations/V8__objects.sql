-- Projects, roadmaps and dashboards as rows, so access can be given to one of them and not to the others (ADR-0010).
-- The id is the one the app already gives each (text, chosen by the app); the body is the object as the app holds it.

CREATE TABLE objects (
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('project','roadmap','dashboard')),
  id         text NOT NULL CHECK (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  position   integer NOT NULL DEFAULT 0,
  doc        jsonb NOT NULL CHECK (pg_column_size(doc) <= 262144),
  version    integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, kind, id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON objects TO lira_app;
