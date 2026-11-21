-- Signing in with Google. A person who signs up with Google has no password, and Google's own account id (the "sub" claim) is how they
-- are recognised again. email_verified says whether the address has been proven to belong to the person (Google proves it).

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN google_sub text UNIQUE;
ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD CONSTRAINT users_can_sign_in CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL);
