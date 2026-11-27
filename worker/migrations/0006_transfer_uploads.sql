CREATE TABLE transfer_uploads (
  transfer_id TEXT NOT NULL REFERENCES cloud_transfers(id) ON DELETE CASCADE,
  file_index INTEGER NOT NULL,
  PRIMARY KEY (transfer_id, file_index)
);
