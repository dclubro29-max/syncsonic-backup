CREATE TABLE cloud_transfers (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  files TEXT NOT NULL CHECK (json_valid(files)),
  expires_at INTEGER NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0 CHECK (ready IN (0, 1))
);
CREATE INDEX cloud_transfers_owner ON cloud_transfers(owner_id, expires_at);
