-- Pre-provisioned identities. Access login enforcement is campaign item 4.
-- IDs are stable library owner keys; the first account keeps the existing 'operator' id.
CREATE TABLE users (
  id         TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  email      TEXT NOT NULL UNIQUE CHECK (length(email) > 0 AND email = lower(trim(email))),
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);
