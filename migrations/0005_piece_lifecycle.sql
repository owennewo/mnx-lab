-- A piece the owner deleted in Studio. Soft, because the storage contract never
-- deletes: the row, its renditions, recordings, tags and blobs all stay, and
-- `deleted_at` hides the piece from every read until it is restored.
ALTER TABLE pieces ADD COLUMN deleted_at TEXT;
