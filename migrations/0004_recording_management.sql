-- Raw import provenance is separate from the validated syncpoint array.
ALTER TABLE recordings ADD COLUMN provenance TEXT;
-- Short-lived browser upload reservations; never confer read access to an R2 key.
CREATE TABLE recording_uploads (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  piece_id TEXT NOT NULL REFERENCES pieces(id),
  expected_revision INTEGER NOT NULL,
  metadata TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  mime TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete','cancelled')),
  expires_at TEXT NOT NULL
);
CREATE INDEX recording_uploads_expiry ON recording_uploads (owner, expires_at);
