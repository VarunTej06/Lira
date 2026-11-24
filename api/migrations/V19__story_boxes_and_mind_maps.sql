-- Story boxes (estimating story points together) and mind maps are two more kinds of object, each with grants like the others. Votes on
-- a story box are rows of their own: a person who may only view the box can still give their own points, and can change nothing else.
ALTER TABLE objects DROP CONSTRAINT objects_kind_check;
ALTER TABLE objects ADD CONSTRAINT objects_kind_check CHECK (kind IN ('project', 'roadmap', 'dashboard', 'storybox', 'mindmap'));
ALTER TABLE grants DROP CONSTRAINT grants_object_kind_check;
ALTER TABLE grants ADD CONSTRAINT grants_object_kind_check CHECK (object_kind IN ('space', 'project', 'roadmap', 'dashboard', 'storybox', 'mindmap'));

CREATE TABLE story_votes (
  org_id     uuid    NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  box_id     text    NOT NULL,
  ticket_id  bigint  NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id    uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points     numeric(6, 1) NOT NULL CHECK (points >= 0 AND points <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, box_id, ticket_id, user_id)
);
CREATE INDEX story_votes_box ON story_votes (org_id, box_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON story_votes TO lira_app;
