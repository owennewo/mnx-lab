# Studio storage — how a piece of music is stored in Cloudflare

**Scope: the shape of the data at rest.** What a *piece* is, which Cloudflare service holds
each part of it, the D1 schema, the R2 key layout, and the rules that keep the whole thing
honest (immutable renditions, one canonical pointer, tags as a projection). Sync protocol,
sharing tiers and the editing authority are named only where they constrain the storage
shape; they get their own documents when they start. The implementation order is the
[studio storage campaign](../roadmap/proposed/studio-campaign-storage.md).

History: this began as the roadmap proposal *studio-storage-sync* (2026-08-11, design only),
which also carried the op-log sync engine and the sharing ladder. It was refocused into this
design doc on 2026-09-11 after the first real ingest — two scores exported from Soundslice
with their recordings, syncpoints and lists — settled what the storage unit actually is. The
earlier text, including the CRDT-versus-rebase argument and the sharing tiers, is in git
history at that path; the parts that still bind storage are restated here.

## The unit is a piece, and a piece has many renditions

A **piece** is one item of music as the owner thinks of it: "Blues Run The Game, Ole
Kirkeng's arrangement". It is *not* a file. A piece owns:

- **Renditions** — notation files, any number, any format: the `.gp5` as uploaded, the
  `.gp` Soundslice re-exported, Soundslice's MusicXML, the MNX our converter derived from
  the `.gp`, the MNX derived from the MusicXML. Every one is kept. Every one is immutable.
- **Recordings** — uploaded audio or video, or a link to YouTube, each with its
  **syncpoints** (bar → seconds).
- **Tags** — `dimension:value` pairs, some derived from the music, some asserted by a
  person.
- **Provenance** — where it came from (a Soundslice slice id, an upload), when, and what
  produced each file.

Keeping every rendition is deliberate and is the design's main reason to exist beyond
"studio has songs": with the original, each exporter's output and each converter's output
stored side by side, **a converter bug is a diff** between two renditions of the same piece
rather than a bug report. The first ingest already produced three findings about Soundslice's
MusicXML exporter this way (no title, no capo, blank `<step>` on every flattened note).

### Multiple formats, one canonical pointer

The on-disk canonical format is **not decided**, and the schema does not need it decided.
Each piece carries a `canonical_rendition_id`. It may point at a `.gp5`, a `.gp` or an MNX.
Everything that needs "the document" resolves through it:

1. Take the canonical rendition.
2. If it is not MNX, take its **current derived MNX child**: the `mnx` rendition whose
   `derived_from` is the canonical one and whose `producer_version` is the converter
   version in use. (The sync tool and the re-index sweep create that child; it is a stored
   rendition like any other.)
3. Read from that MNX.

So derived tags, the player, and the workbench all read MNX, while the file the owner
regards as the source can be any format. Changing the canonical pointer is a row update.

**Editing moves the pointer.** A `.gp5` cannot be edited in place. The first studio edit of a
piece produces an MNX document, stored as a new rendition, and canonical moves to it. A
`.gp` exported afterwards is another derived rendition, never a mutation of the original
upload. After the first edit, canonical is necessarily MNX.

## What lives where

| Data | Store | Why there |
| --- | --- | --- |
| Piece identity, provenance, canonical pointer | **D1** | The one cross-piece query surface |
| Rendition files (`.gp`, `.gp5`, `.gpx`, `.musicxml`, `.mnx.json`) | **R2** blob, **D1** row | Immutable, content-addressed; derived MNX runs 300 KB–1 MB, too large for a D1 text column |
| Recordings (uploaded audio/video) | **R2** blob, **D1** row | Bulk of the bytes (10 MB of the first ingest's 12 MB); zero egress |
| YouTube-linked recordings | **D1** row only | Nothing to store but the id |
| Syncpoints | **D1**, JSON column on the recording | ~10 KB, read whole by the player |
| Tags, aliases | **D1** | The most relational data in the design |
| The editable document, once editing exists | **Durable Object** (later) | See *When the Durable Object arrives* |
| KV | **nothing** | Eventually consistent, last-writer-wins: the two properties a record must not have |

**D1** is Cloudflare's hosted SQLite: one database for the whole application, every piece a
row in it, accessed from the Worker through a binding. It is not one database per piece; the
per-object SQLite in the Durable Object section is a different product.

**R2** holds bytes and nothing else. It has no transactions and no logic in front of a write,
which is why it is never the authority for anything that changes; it is the right home for
things that never change.

## D1 schema

```sql
CREATE TABLE pieces (
  id                     TEXT PRIMARY KEY,          -- ulid
  owner                  TEXT NOT NULL,             -- one user today; carried now so multi-user is auth, not migration
  canonical_rendition_id TEXT REFERENCES renditions(id),
  source_kind            TEXT,                      -- 'soundslice' | 'upload'
  source_id              TEXT,                      -- e.g. the slice id 'wJPHc'
  source_url             TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE TABLE renditions (
  id               TEXT PRIMARY KEY,
  piece_id         TEXT NOT NULL REFERENCES pieces(id),
  format           TEXT NOT NULL,   -- 'gp' | 'gpx' | 'gp5' | 'gp4' | 'gp3' | 'musicxml' | 'mnx'
  role             TEXT NOT NULL,   -- 'original' | 'export' | 'derived'
  sha256           TEXT NOT NULL,
  r2_key           TEXT NOT NULL,
  bytes            INTEGER NOT NULL,
  producer         TEXT NOT NULL,   -- 'user-upload' | 'soundslice-exporter' | 'guitarpro-mnx' | 'musicxml-mnx' | 'studio'
  producer_version TEXT,
  derived_from     TEXT REFERENCES renditions(id),
  fetched_at       TEXT,
  created_at       TEXT NOT NULL,
  UNIQUE (piece_id, sha256)
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
  created_at  TEXT NOT NULL
);

CREATE TABLE tags (
  owner     TEXT NOT NULL,
  piece_id  TEXT NOT NULL REFERENCES pieces(id),
  dimension TEXT NOT NULL,          -- 'title' | 'artist' | 'tuning' | 'capo' | 'list' | 'genre' | 'unknown' | ...
  value     TEXT NOT NULL,
  origin    TEXT NOT NULL,          -- 'derived' | 'asserted'
  sort_key  INTEGER,                -- setlist order
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
```

Notes on the choices:

- **Pieces and renditions reference each other.** Insert the piece with a null canonical,
  insert the renditions, then set the pointer. D1 enforces foreign keys; the column stays
  nullable.
- **`renditions.derived_from` is provenance and is not inferable from the canonical
  pointer.** A piece will have several derived renditions with different parents (MNX from
  the `.gp`, MNX from the MusicXML), and the canonical pointer moves while old renditions
  keep their history.
- **Tags carry no `derived_from`.** Derived tags are a cache of one path through the
  rendition graph (canonical → current MNX child → `_x.mnxLab.work`); their inputs are the
  canonical pointer and the converter version, both known without a per-row column, and
  the cache is rebuilt whole. At this library size a full re-index is seconds.
- **Syncpoints as a JSON column** because the player reads the whole array. Split into rows
  only if a query by bar is ever needed.
- **`owner` from day one** costs nothing and matches the tag shape the sharing design wants,
  so a second user is an auth change, not a schema migration.

## R2 key layout

Content-addressed for renditions and recordings, so a re-upload of identical bytes is a
no-op and the key never lies about its contents:

```
renditions/<sha256>                 the file, any format; format and name live in D1
recordings/<sha256>                 uploaded audio/video
```

Object metadata carries the original filename and MIME type for download convenience; the
row is the record. Nothing under either prefix is ever overwritten or deleted by the app;
garbage collection of unreferenced blobs is an explicit, separate sweep.

## Tags: derived and asserted, one shape

Every tag is `dimension:value`. The dimension is always present, even when nobody has chosen
it yet: an imported Soundslice list "80s" lands as `unknown:80s` and is renamed to
`genre:80s` by a row update. A hierarchical list path ("tunings / drop d") lands as one
value in a path dimension, not as nested rows.

Two origins, and the direction of truth differs:

- **Derived** tags are read from the music: `title`, `artist` (and the rest of
  `_x.mnxLab.work`), `tuning` and `capo` from the part-level `strings[]`/`capo`. They are
  **materialised at write time** — on import, and on every accepted edit — into the tags
  table, and are **never typed**. A re-index sweep rebuilds them from the blobs alone. The
  table is a cache of the documents, not a second source of truth.
- **Asserted** tags exist only because a person typed them: lists, genre, setlists. D1 is
  their system of record.

**Truth flows document → tag, never tag → document.** Renaming a derived tag therefore means
one of two distinct things, and the design keeps them apart:

1. **A display-level correction.** `tag_aliases` maps `artist:Bob Dilan` to `Bob Dylan` for
   grouping and display while every document is untouched. Cheap, reversible; a re-index
   still reproduces the raw tag, and the alias still applies.
2. **An actual document edit.** A deliberate "apply to documents" action emits an edit op
   setting `work.artist` on each affected *canonical MNX* through the same op funnel as any
   other edit (`src/edit/ops.ts`), so it is validated, logged and undoable. Each changed
   document then re-derives its tags. Any `.gp` or MusicXML exported afterwards is a **new
   derived rendition**; original uploads are immutable and cannot be renamed inside.

The dangerous version — a SQL update on the tag row that reaches back and rewrites JSON, or
worse, a `.gp` — is not expressible in this shape, which is the point.

**Derived tags come from one rendition.** The `.gp5` of Blues Run The Game says the artist is
"Original version by Jackson C.Frank"; the Soundslice `.gp` says "Jackson C.Frank (Ole
Kirkeng)". Which is the piece's artist is a choice, and the canonical pointer is where the
choice lives.

## Syncpoints index performed bars

Soundslice's syncpoints count bars as performed, with repeats unrolled: Sweet Child O' Mine
has 82 written bars and 139 syncpoints; Blues Run The Game has 151 written bars and 152
syncpoints (the last is an end marker). The column comment records this because a player
that maps them onto written bars will be wrong on any piece with a repeat. The player
campaign's unroll (`core-campaign-player.md`, performed ordinals) is what turns a syncpoint
into a position.

## When the Durable Object arrives

Nothing above needs one. A save today is a whole-document write of a new rendition and a
pointer move. A **Durable Object** is a single-threaded actor with its own private SQLite,
so every request to one document runs one at a time and the object can validate an edit,
apply it, append it to a log, bump a version and persist all of that in one transaction.
Blobs cannot do that: an R2 write is a whole-object replace with no transaction and no logic
in the way, so two devices saving the same document is last-writer-wins and one of them
silently loses.

The trigger is concrete: **the first time a document has two writers** — studio editing the
same piece from two devices, a shared collection, or the assist loop pushing ops
server-side. At that point:

- The DO becomes the **system of record for the live document**: current state plus the op
  log (which is also its version history). It is created lazily on the first edit and exists
  only for edited pieces.
- R2 keeps holding **immutable artefacts**, now including **snapshots exported from the DO**
  at a given version. A snapshot is a pure function of DO state — a cache of the record,
  never the record.
- D1 stays the index over both. The canonical pointer for an edited piece resolves to the
  DO's current snapshot rendition rather than an upload. **The tables do not change shape;
  only what the pointer resolves to does.**

The reasoning that chose a server-authoritative op-log (the Replicache model over
`EditOp`/`applyOp`) rather than a CRDT — the `.mnx.json` **is** the artifact; a foreign
source of truth underneath it is the wrong trade unless real-time co-editing becomes a
headline feature — is recorded in the original proposal (git history of this file) and is
unchanged. So is the boundary note: applying `EditOp`s server-side means a worker needs
`applyOp`, and today's ceiling is `worker: model + assist only`; that is a boundary decision
to make deliberately when the DO starts, in studio's own backend rules.

## Invariants

1. **Renditions and recordings are immutable.** New bytes are a new row and a new key.
   Nothing in R2 is overwritten by the application.
2. **One canonical pointer per piece**, and it is the only thing that says which rendition
   is "the document".
3. **Derived tags are a projection** of the canonical rendition seen through the current
   converter; they are never edited and always rebuildable. Asserted tags are data.
4. **Originals are never rewritten.** A correction to metadata is an alias or an edit op on
   the canonical MNX; either way, the uploaded file stands.
5. **Producer and version on every rendition**, including the ones third parties made
   (Soundslice's exporter, an uploader's Guitar Pro). When two derived renditions disagree
   you need to know which side to blame.

## Out of scope here

- The sync protocol (push/pull, client replica, offline queue) and the DO's internal schema.
- The sharing ladder (URL-fragment, tag-shares, publish tier) and copyright handling at the
  publish moment.
- Auth. The workbench's read access and studio's accounts are the campaign's discussion
  blocker, not a storage question.
- Cost. Everything here fits the Workers free plan for development; the $5/mo Workers Paid
  plan is the floor the day real users arrive (the free tier's ceilings are hard daily caps
  that fail writes rather than bill).
