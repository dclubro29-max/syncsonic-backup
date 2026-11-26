CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  skin TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE remote_devices (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE remote_commands (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  play_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id, device_id) REFERENCES remote_devices(user_id, device_id) ON DELETE CASCADE
);
CREATE INDEX remote_commands_device ON remote_commands(user_id, device_id, play_at);

CREATE TABLE calibration_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  expires_at INTEGER NOT NULL,
  UNIQUE (user_id, code)
);
