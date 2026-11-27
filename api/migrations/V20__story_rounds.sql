-- A voting round: one ticket put in front of everyone for a limited time. Votes stay hidden from others until someone who runs the box
-- reveals them; then the final points are confirmed. One row per ticket per box; starting it again (a revote) resets the row.
CREATE TABLE story_rounds (
  org_id        uuid    NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  box_id        text    NOT NULL,
  ticket_id     bigint  NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  started_by    uuid    REFERENCES users(id) ON DELETE SET NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz NOT NULL,
  revealed_at   timestamptz,
  final_points  numeric(6, 1) CHECK (final_points >= 0 AND final_points <= 1000),
  confirmed_by  uuid    REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at  timestamptz,
  PRIMARY KEY (org_id, box_id, ticket_id)
);
CREATE INDEX story_rounds_box ON story_rounds (org_id, box_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON story_rounds TO lira_app;
