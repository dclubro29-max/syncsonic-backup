CREATE TABLE library_pairs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sender', 'receiver')),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  expires_at INTEGER NOT NULL,
  UNIQUE (user_id, code, role)
);
