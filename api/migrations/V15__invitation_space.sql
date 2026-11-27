-- An invitation can name one space and the level of access to it (view, edit or manage). Accepting it joins the organisation and grants
-- only that space, so the invited person sees nothing else. Both columns are set together or neither.
ALTER TABLE invitations ADD COLUMN space_id bigint REFERENCES spaces(id) ON DELETE CASCADE;
ALTER TABLE invitations ADD COLUMN space_level text CHECK (space_level IN ('view', 'edit', 'manage'));
ALTER TABLE invitations ADD CONSTRAINT invitations_space_with_level CHECK ((space_id IS NULL) = (space_level IS NULL));

-- What else of the space the invited person sees. Tickets and their comments always come with the space. The others are switches, all
-- on by default: the projects, roadmaps and dashboards tied to the space, and the sprints. Copied to space_shares when the invitation is accepted.
ALTER TABLE invitations ADD COLUMN share_projects   boolean NOT NULL DEFAULT true;
ALTER TABLE invitations ADD COLUMN share_roadmaps   boolean NOT NULL DEFAULT true;
ALTER TABLE invitations ADD COLUMN share_dashboards boolean NOT NULL DEFAULT true;
ALTER TABLE invitations ADD COLUMN share_sprints    boolean NOT NULL DEFAULT true;

-- The same switches for a person who is already in the space, so the Owner can change them later.
CREATE TABLE space_shares (
  org_id     uuid   NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id    uuid   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space_id   bigint NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  projects   boolean NOT NULL DEFAULT true,
  roadmaps   boolean NOT NULL DEFAULT true,
  dashboards boolean NOT NULL DEFAULT true,
  sprints    boolean NOT NULL DEFAULT true,
  PRIMARY KEY (org_id, user_id, space_id)
);
CREATE INDEX space_shares_user ON space_shares (user_id, org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON space_shares TO lira_app;
