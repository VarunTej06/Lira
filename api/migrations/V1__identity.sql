-- Identity: organisations, users, memberships, sessions, login attempts and the audit log.
-- Written for PostgreSQL 16. The file name follows Flyway's V<number>__<name>.sql, so Flyway can adopt these files later unchanged.

CREATE TABLE organisations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Identity is global: one person, one account, however many organisations they belong to.
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  password_hash text NOT NULL,            -- an Argon2id hash made by the API; the database never sees a password
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));

CREATE TABLE memberships (
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner','admin','manager','member','viewer','guest')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX memberships_user ON memberships (user_id);

-- Only a hash of the session token is stored, so a copy of this table cannot be used to sign in.
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  remember     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expiry ON sessions (expires_at);

-- Counts for the lock after repeated wrong passwords. The key is a hash of the email or the address, never the value itself.
CREATE TABLE login_attempts (
  id       bigserial PRIMARY KEY,
  key_hash text NOT NULL,
  ok       boolean NOT NULL,
  at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_key_time ON login_attempts (key_hash, at);

-- Append-only record of who did what and when. The application role can add rows and read them, never change or delete them.
CREATE TABLE audit_log (
  id        bigserial PRIMARY KEY,
  at        timestamptz NOT NULL DEFAULT now(),
  actor     uuid,
  org_id    uuid,
  action    text NOT NULL,
  outcome   text NOT NULL CHECK (outcome IN ('ok','denied','error')),
  source_ip text,
  detail    jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_log_actor_time ON audit_log (actor, at);
