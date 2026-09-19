-- How the owner last had a piece SET UP, beside when they last opened it: the
-- source they last played and the Instruments sheet's mix. Per owner and piece,
-- server-side for the reason `opened_at` is — it should hold across devices and
-- survive a cleared browser.
--
-- Opaque JSON. The Worker stores and caps it but never reads inside it: the
-- shapes it carries (a part mix, a sample preset) live in `src/audio`, which the
-- Worker's layer ceiling forbids it to import, and the shell already normalizes
-- what it reads. So a new sample pack is never a migration.
ALTER TABLE piece_views ADD COLUMN prefs TEXT;
ALTER TABLE piece_views ADD COLUMN prefs_updated_at TEXT;
