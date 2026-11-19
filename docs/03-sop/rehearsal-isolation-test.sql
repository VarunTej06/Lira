-- Rehearsal: can one organisation read or change another's data? Run it as the server admin with psql (see azure-playground-rehearsal.md).
-- Every check prints PASS or stops with FAIL. It uses only made-up sample rows and its own database, lira_rehearsal.
\set ON_ERROR_STOP on

CREATE DATABASE lira_rehearsal;
\c lira_rehearsal

-- The application's role. It does not own the tables and is not a superuser, so it cannot switch the protection off.
CREATE ROLE lira_app NOLOGIN;
GRANT lira_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO lira_app;

CREATE TABLE organisations (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  password_hash text NOT NULL        -- an Argon2id hash made by the application; the database never sees a password
);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));
CREATE TABLE memberships (
  org_id uuid NOT NULL REFERENCES organisations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('owner','admin','manager','member','viewer','guest')),
  PRIMARY KEY (org_id, user_id)
);
CREATE TABLE tickets (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organisations(id),
  key text NOT NULL,
  title text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Append-only: the application may add rows and read them, never change or delete them.
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organisations(id),
  actor uuid,
  action text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO organisations VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Org A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Org B');
INSERT INTO tickets (id, org_id, key, title) VALUES
  ('a1a1a1a1-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A-1', 'Org A ticket one'),
  ('a2a2a2a2-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'A-2', 'Org A ticket two'),
  ('b1b1b1b1-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'B-1', 'Org B ticket one');

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;
-- A row is visible and writable only when it belongs to the organisation the application named for this transaction.
CREATE POLICY tenant ON tickets
  USING      (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON tickets TO lira_app;
GRANT SELECT, INSERT ON audit_log TO lira_app;
GRANT USAGE ON SEQUENCE audit_log_id_seq TO lira_app;
GRANT SELECT ON organisations, memberships, users TO lira_app;

-- 1. Org A sees only its two tickets.
DO $$ DECLARE n int; BEGIN
  SET LOCAL ROLE lira_app; PERFORM set_config('app.org_id', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  SELECT count(*) INTO n FROM tickets;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL 1: Org A should see 2 tickets, saw %', n; END IF;
  RAISE NOTICE 'PASS 1: Org A sees only its own 2 tickets';
END $$;

-- 2. Org B sees only its one ticket.
DO $$ DECLARE n int; BEGIN
  SET LOCAL ROLE lira_app; PERFORM set_config('app.org_id', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  SELECT count(*) INTO n FROM tickets;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 2: Org B should see 1 ticket, saw %', n; END IF;
  RAISE NOTICE 'PASS 2: Org B sees only its own ticket';
END $$;

-- 3. With no organisation named, nothing is visible.
DO $$ DECLARE n int; BEGIN
  SET LOCAL ROLE lira_app;
  SELECT count(*) INTO n FROM tickets;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 3: with no organisation named, % tickets were visible', n; END IF;
  RAISE NOTICE 'PASS 3: with no organisation named, nothing is visible';
END $$;

-- 4. Org A cannot read Org B's ticket even by guessing its id.
DO $$ DECLARE n int; BEGIN
  SET LOCAL ROLE lira_app; PERFORM set_config('app.org_id', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  SELECT count(*) INTO n FROM tickets WHERE id = 'b1b1b1b1-0000-0000-0000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 4: Org A read Org B ticket by id'; END IF;
  RAISE NOTICE 'PASS 4: a guessed id from another organisation returns nothing';
END $$;

-- 5. Org A cannot plant a row in Org B.
DO $$ BEGIN
  SET LOCAL ROLE lira_app; PERFORM set_config('app.org_id', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  BEGIN
    INSERT INTO tickets (id, org_id, key, title) VALUES (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000002', 'B-9', 'planted');
    RAISE EXCEPTION 'FAIL 5: Org A planted a ticket in Org B';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 5: writing into another organisation is refused';
  END;
END $$;

-- 6. Org A cannot change or delete Org B's ticket.
DO $$ DECLARE u int; d int; BEGIN
  SET LOCAL ROLE lira_app; PERFORM set_config('app.org_id', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  UPDATE tickets SET title = 'changed' WHERE key = 'B-1'; GET DIAGNOSTICS u = ROW_COUNT;
  DELETE FROM tickets WHERE key = 'B-1'; GET DIAGNOSTICS d = ROW_COUNT;
  IF u <> 0 OR d <> 0 THEN RAISE EXCEPTION 'FAIL 6: Org A changed % and deleted % of Org B rows', u, d; END IF;
  RAISE NOTICE 'PASS 6: changing or deleting another organisation''s ticket affects 0 rows';
END $$;

-- 7. The application cannot switch the protection off.
DO $$ BEGIN
  SET LOCAL ROLE lira_app;
  BEGIN
    ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
    RAISE EXCEPTION 'FAIL 7: the application role switched row-level security off';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 7: the application role cannot switch the protection off';
  END;
END $$;

-- 8. The application can add to the audit log.
DO $$ DECLARE n int; BEGIN
  SET LOCAL ROLE lira_app;
  INSERT INTO audit_log (org_id, action) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'test');
  SELECT count(*) INTO n FROM audit_log;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 8: audit row not added'; END IF;
  RAISE NOTICE 'PASS 8: the application can add an audit record';
END $$;

-- 9. The application cannot change or delete audit records.
DO $$ BEGIN
  SET LOCAL ROLE lira_app;
  BEGIN
    UPDATE audit_log SET action = 'x';
    RAISE EXCEPTION 'FAIL 9: the application changed an audit record';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM audit_log;
    RAISE EXCEPTION 'FAIL 9: the application deleted an audit record';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 9: audit records cannot be changed or deleted by the application';
  END;
END $$;

\echo 'All nine checks passed. Drop the test database when done: DROP DATABASE lira_rehearsal;'
