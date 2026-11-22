-- A call belongs to something: the whole organisation (a stand-up), a space, a project or a sprint. The popup on each of those
-- shows the calls of that one thing; the Manage calls page shows them all.
ALTER TABLE standup_calls
  ADD COLUMN scope_type text NOT NULL DEFAULT 'org' CHECK (scope_type IN ('org','space','project','sprint')),
  ADD COLUMN scope_id   text NOT NULL DEFAULT '' CHECK (length(scope_id) <= 80),
  ADD COLUMN scope_name text NOT NULL DEFAULT '' CHECK (length(scope_name) <= 120),
  ADD CONSTRAINT standup_scope_needs_id CHECK ((scope_type = 'org') = (scope_id = ''));
CREATE INDEX standup_calls_scope ON standup_calls (org_id, scope_type, scope_id);
