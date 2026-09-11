-- Implementation loop: studio library schema, matching docs/studio-storage.md.
CREATE TABLE pieces (
  id                     TEXT PRIMARY KEY,          -- ulid
  owner                  TEXT NOT NULL,             -- one user today; carried now so multi-user is auth, not migration
  canonical_rendition_id TEXT REFERENCES renditions(id),
  source_kind            TEXT,                      -- 'soundslice' | 'upload'
  source_id              TEXT,                      -- e.g. the slice id 'wJPHc'
  source_url             TEXT,
  revision               INTEGER NOT NULL DEFAULT 0,  -- compare-and-set on every write to the piece
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  UNIQUE (owner, source_kind, source_id)
);

CREATE TABLE renditions (
  id               TEXT PRIMARY KEY,
  piece_id         TEXT NOT NULL REFERENCES pieces(id),
  format           TEXT NOT NULL,   -- 'gp' | 'gpx' | 'gp5' | 'gp4' | 'gp3' | 'musicxml' | 'mnx'
  role             TEXT NOT NULL,   -- 'original' | 'export' | 'derived'
  filename         TEXT,            -- as uploaded / as exported; presentation, never identity
  sha256           TEXT NOT NULL,
  r2_key           TEXT NOT NULL,   -- 'renditions/<sha256>'; several rows may share one key
  bytes            INTEGER NOT NULL,
  producer         TEXT NOT NULL,   -- 'user-upload' | 'soundslice-exporter' | 'soundslice-cli' | 'guitarpro-mnx' | 'musicxml-mnx' | 'studio'
  producer_version TEXT,            -- package version, plus git sha when run from a checkout
  producer_options TEXT,            -- JSON: the flags the producer ran with (e.g. encoding date off)
  provenance       TEXT,            -- JSON, free-form: upstream sha256, injected header, fetch source
  derived_from     TEXT REFERENCES renditions(id),
  fetched_at       TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE recordings (
  id          TEXT PRIMARY KEY,
  piece_id    TEXT NOT NULL REFERENCES pieces(id),
  kind        TEXT NOT NULL,        -- 'audio' | 'video' | 'youtube'
  name        TEXT,
  r2_key      TEXT,                 -- null for youtube
  sha256      TEXT,
  bytes       INTEGER,
  mime        TEXT,
  external_id TEXT,                 -- youtube video id
  duration_s  REAL,
  syncpoints  TEXT,                 -- JSON [[bar, seconds, pos?, hide?]]; PERFORMED bars, 0-based
  source_id   TEXT,                 -- e.g. the soundslice recording id
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX recordings_by_source ON recordings (piece_id, source_id) WHERE source_id IS NOT NULL;

CREATE TABLE tags (
  owner     TEXT NOT NULL,
  piece_id  TEXT NOT NULL REFERENCES pieces(id),
  dimension TEXT NOT NULL,          -- 'title' | 'artist' | 'tuning' | 'capo' | 'list' | 'genre' | 'unknown' | ...
  value     TEXT NOT NULL,
  origin    TEXT NOT NULL,          -- 'derived' | 'asserted'
  sort_key  INTEGER,                -- setlist order
  source_ref TEXT,                  -- asserted-by-import only: e.g. 'soundslice-list:6YDH7'; survives a rename
  PRIMARY KEY (owner, piece_id, dimension, value)
);
CREATE INDEX tags_by_value ON tags (owner, dimension, value);

CREATE TABLE tag_aliases (
  owner           TEXT NOT NULL,
  dimension       TEXT NOT NULL,
  raw_value       TEXT NOT NULL,
  canonical_value TEXT NOT NULL,
  PRIMARY KEY (owner, dimension, raw_value)
);

-- A writer supplies expected_revision + 1. A stale writer aborts the whole batch.
CREATE TRIGGER pieces_revision_cas
BEFORE UPDATE OF revision ON pieces
WHEN NEW.revision != OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'library_revision_conflict');
END;
