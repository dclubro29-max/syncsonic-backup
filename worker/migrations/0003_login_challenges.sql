CREATE TABLE login_challenges (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX login_challenges_expiry ON login_challenges(expires_at);

CREATE TABLE login_email_requests (
  email TEXT PRIMARY KEY NOT NULL,
  last_sent INTEGER NOT NULL
);

CREATE TABLE login_address_requests (
  address_hash TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
