-- What the application's database role may do. It owns nothing, so it cannot create, alter or drop a table.
-- The role itself is created by the migration runner (its password never appears in a file).

GRANT USAGE ON SCHEMA public TO lira_app;

GRANT SELECT, INSERT, UPDATE ON users TO lira_app;                    -- UPDATE: last sign-in time, later a password change
GRANT SELECT, INSERT ON organisations, memberships TO lira_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO lira_app;         -- DELETE: log out, and clearing expired sessions
GRANT SELECT, INSERT, DELETE ON login_attempts TO lira_app;           -- DELETE: clearing old attempts
GRANT SELECT, INSERT ON audit_log TO lira_app;                        -- no UPDATE and no DELETE: the log is append-only

GRANT USAGE ON SEQUENCE login_attempts_id_seq, audit_log_id_seq TO lira_app;
