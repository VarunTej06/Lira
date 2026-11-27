-- Two-step sign-in with an authenticator app. The secret is kept encrypted by the API (the key lives in the secret store), the app's codes
-- are the usual six digits every 30 seconds, and ten one-time recovery codes are kept only as hashes.
CREATE TABLE user_two_step (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret       text NOT NULL,
  confirmed_at timestamptz,       -- null until the person has typed a first code, so a half-finished set-up does not lock them out
  last_step    bigint NOT NULL DEFAULT 0  -- the last 30-second step accepted: a code works once
);

CREATE TABLE two_step_recovery (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at   timestamptz,
  PRIMARY KEY (user_id, code_hash)
);

-- Between the right password and the code. Only a hash of the token is stored; it lasts ten minutes and allows five wrong codes.
CREATE TABLE login_challenges (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remember   boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_two_step, two_step_recovery, login_challenges TO lira_app;
