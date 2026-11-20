-- Teams and access (ADR-0010). A grant says: this person or this team has this level on this object. The highest level that applies wins.
-- Owner and Admin are not listed here: their role gives them everything in the organisation.

CREATE TABLE teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX teams_name ON teams (org_id, lower(name));

CREATE TABLE team_members (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX team_members_user ON team_members (user_id);

CREATE TABLE grants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('user','team')),
  subject_id   uuid NOT NULL,
  object_kind  text NOT NULL CHECK (object_kind IN ('space','project','roadmap','dashboard')),
  object_id    text NOT NULL CHECK (length(object_id) BETWEEN 1 AND 80),
  level        text NOT NULL CHECK (level IN ('view','edit','manage')),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, subject_type, subject_id, object_kind, object_id)
);
CREATE INDEX grants_object ON grants (org_id, object_kind, object_id);
CREATE INDEX grants_subject ON grants (subject_type, subject_id);

-- The owner can switch off, per person, whether an Admin may manage people, teams and access (an Admin may by default).
ALTER TABLE memberships ADD COLUMN manage_access boolean NOT NULL DEFAULT true;

GRANT SELECT, INSERT, UPDATE, DELETE ON teams, team_members, grants TO lira_app;
GRANT UPDATE, DELETE ON memberships TO lira_app;
