-- Recently opened, per owner and piece: written when a piece page opens, read by
-- the library's recent sort. One row per (owner, piece); opened_at is the latest.
CREATE TABLE piece_views (
  owner     TEXT NOT NULL,
  piece_id  TEXT NOT NULL REFERENCES pieces(id),
  opened_at TEXT NOT NULL,
  PRIMARY KEY (owner, piece_id)
);
