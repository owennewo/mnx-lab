# Studio storage — how a piece of music is stored in Cloudflare

**Scope: the shape of the data at rest.** What a *piece* is, which Cloudflare service holds
each part of it, the D1 schema, the R2 key layout, and the rules that keep the whole thing
honest (immutable renditions, one canonical pointer, tags as a projection). Sync protocol,
sharing tiers and the editing authority are named only where they constrain the storage
shape; they get their own documents when they start. The implementation order is the
[studio storage campaign](../roadmap/complete/studio-campaign-storage.md).

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

**MNX is the lab's working format, not — yet — its storage format** (decided 2026-09-11,
[studio-storage-source-canonical](../roadmap/inprogress/studio-storage-source-canonical.md)):
the spec is too incomplete to bet a library on. So the service stores what the source
system exported and **nothing derived from it**. Each piece carries a
`canonical_rendition_id`; for a Soundslice piece it is the Soundslice `.gp`, asserted by the
ingest and enforced by the Worker. Everything that needs "the document" resolves through it:

1. Take the canonical rendition — its bytes, in whatever format they are.
2. **Convert where the music is read**: the shells run the clean-room importer
   (`src/importers/`) in a browser worker, exactly as the workbench opens a `.gp` from disk.
3. The MNX exists in memory, for that reader, and is never written back.

No derived MNX child is stored, no converter version is pinned on the service, and a
converter change touches the service not at all. Derived tags (title, artist, capo,
tuning) are a **projection** computed by the ingest tool — from the Soundslice sidecar and
from a conversion it ran in *validation mode* and threw away — and sent with the manifest;
the Worker accepts them and derives nothing itself. Changing the canonical pointer is a row
update. (Rows of derived MNX stored before this decision remain, immutable and unused.)

**Piece ids are the service's.** The Worker derives a piece's id from its source identity
(the first 16 hex digits of a SHA-256 over kind and source id): opaque and URL-safe, so a
reader's `#/piece/<id>` never names the source system, yet deterministic, so a replayed
import lands on the same row. The source itself lives in `source_kind`/`source_id`. The
schema's `-- ulid` comment predates this and is left as the migration wrote it.

**The pointer is set explicitly and then belongs to the owner.** An import sets canonical
only when the piece has none — for a Soundslice slice, to the Soundslice `.gp`, the most
complete rendition on hand — and never moves it afterwards. A later import adds renditions;
the owner's choice stands.

**Editing moves the pointer.** A `.gp5` cannot be edited in place. The first studio edit of a
piece produces an MNX document, stored as a new rendition, and canonical moves to it. A
`.gp` exported afterwards is another derived rendition, never a mutation of the original
upload. After the first edit, canonical is necessarily MNX.

## What lives where

| Data | Store | Why there |
| --- | --- | --- |
| Piece identity, provenance, canonical pointer | **D1** | The one cross-piece query surface |
| Rendition files (`.gp`, `.gp5`, `.gpx`, `.musicxml`, `.mnx.json`) | **R2** blob, **D1** row | Immutable, content-addressed. Not because D1 could not hold a 1 MB MNX (its per-value cap is in the low megabytes) but so every rendition shares one store and D1 stays a small index |
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
```

Notes on the choices:

- **Pieces and renditions reference each other.** Insert the piece with a null canonical,
  insert the renditions, then set the pointer. D1 enforces foreign keys; the column stays
  nullable. The same-piece rule — the canonical pointer and every `derived_from` name a
  rendition of *this* piece — is a cross-row check a simple foreign key cannot express, so the Worker
  library module enforces it on every write.
- **No uniqueness on `(piece_id, sha256)`.** Blobs deduplicate by themselves because the R2
  key is the hash; rows are cheap and carry the history. A re-derive that produces the same
  bytes as last time still gets its own row — "converter X at version Y, same result" — which
  is exactly the evidence the re-derive sweep reports.
- **The Soundslice `.gp` is a transformed export, and says so.** Soundslice's export carries an
  empty score header; `soundslice-cli` injects the title and artist before caching it. Its
  producer is therefore `soundslice-cli`, with the raw export's sha256 and the injected header
  in `provenance`. The raw bytes are not kept anywhere; the hash is the audit trail.
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
- **`revision` on pieces** is a compare-and-set token: a writer sends the revision it read
  and the write fails if the piece has moved. It stops a stale ingest run from overwriting a
  newer canonical choice today, and it is the same mechanism studio's saves will need.

## Worker library API (item 2)

`worker/library/index.ts` exports `Library(db, bucket)`. Callers
supply the authenticated owner on every operation; this module exposes no HTTP routes.
Item 3 must authenticate its write route before supplying that owner. `getPiece` reads
one consistent snapshot; `findPiece` resolves upstream identity; `listPieces`,
`readRendition`, `readCanonical` (the canonical rendition's bytes, any format) and the
alias methods are owner-scoped. `writePiece` accepts `derived_tags`, the projection: when
present it replaces the piece's derived tags wholesale, when absent they are retained;
only derived dimensions are accepted, each with a `source_ref`.

`writePiece(owner, input)` is the only piece mutation entry. Caller-supplied ids are
stable across retries. `expected_revision: null` creates a piece at revision 0; existing
pieces require their current revision. The first update statement sets the requested
next revision; `pieces_revision_cas` rejects anything other than `OLD.revision + 1`,
so a competing writer aborts the entire batch. A no-op retains its revision and times.
Rendition bytes, lineage and producer identity cannot change under an existing id;
filename, fetch time and provenance may be corrected. New ids may share one hash key.
Recording inputs upsert by source id and retain the stored row id. Missing companions
are retained. `canonical.mode: initialize` preserves any existing pointer; `replace`
is the explicit owner-edit operation. Imports use only `initialize`.

The caller maps producer names to the converter versions in use. A non-MNX canonical
resolves to its matching MNX child, newest by `(created_at, id)` if several history rows
match. No children means no derived tags yet; existing children without a matching
current version cause an error, never a silent clearing or fallback to an older version.
Every piece write re-derives from that selected path. The library validates standard MNX
and the root/part metadata it reads, and checks blob hashes before deriving from stored
MNX. It does not convert formats or use a host wrapper's title.

Derived dimensions are the scalar `work` fields (`title`, `subtitle`, `artist`, `album`,
`copyright`, `source`, `notes`), `creator.<role>`, `tuning` and `capo`. Tuning is explicit
pitches ordered by descending string number, space-separated; nonzero alterations are
signed brackets before the octave, e.g. `F[+1]2`. There are no inferred tuning names or
implicit capo values. The whole `creator.` namespace is reserved for derived tags.
Aliases are display mappings and never modify stored music or raw derived tags.

Stored MNX uses the published schema plus the narrowly validated global `section` and
`rehearsal` labels already emitted by both converters (the score-text proposal). The
storage parser validates those label objects separately and validates the remaining
structure against published MNX, returning the original document unchanged. It does not
accept the full experimental schema. The AI edit route remains published-only. Label
validation is generated from the existing proposal definition; on adoption it can use
the published definition. This preserves source/derived bytes rather than stripping text
to satisfy a narrower validator.

The module accepts buffered blob bytes; the ingest route owns request-size limits and
upload transport. Storage does not expose an unauthenticated route or a direct-upload
credential. Missing write tokens must fail closed when that route is added in item 3.

## R2 key layout

Content-addressed for renditions and recordings, so a re-upload of identical bytes is a
no-op and the key never lies about its contents:

```
renditions/<sha256>                 the file, any format; format and name live in D1
recordings/<sha256>                 uploaded audio/video
```

Filenames and MIME types live on the D1 row, not in object metadata; the row is the record
and a blob may be shared by several rows. Nothing under either prefix is ever overwritten or
deleted by the app; garbage collection of unreferenced blobs is an explicit, separate sweep.

## Writes: order and atomicity

Every write goes through the Worker library module, in this order:

1. **Blobs first.** Put each new rendition or recording into R2 under its hash key, then
   read its size back to verify. A blob with no row is harmless (the sweep collects it); a
   row with no blob is a broken library.
2. **Rows together.** Rendition rows, recording upserts, the canonical pointer, the derived
   tags and the piece's `revision` bump go to D1 as **one batch**, which D1 applies
   transactionally. A reader never sees a piece whose tags describe a rendition that is not
   yet there.
3. **Compare-and-set.** The batch carries the piece revision the writer read; a mismatch
   rejects the whole batch and the writer re-reads. Nothing is ever silently replaced.

The blob is immutable; the row is not. A recording's syncpoints and name may be corrected in
place (upsert on `(piece_id, source_id)`), a rendition's `provenance` may be enriched, and
a piece's pointer may move — each a row update under the revision, none a new blob.

## Tags: derived and asserted, one shape

Every tag is `dimension:value`. The dimension is always present, even when nobody has chosen
it yet: an imported Soundslice list "80s" lands as `unknown:80s` and is renamed to
`genre:80s` by a row update. A hierarchical list path ("tunings / drop d") lands as one
value in a path dimension, not as nested rows.

A dimension is **either derived or asserted, never both**: `title`, `artist`, `tuning` and
`capo` cannot be asserted, so there is never an asserted `artist:X` beside a derived
`artist:Y`. A wrong derived value is corrected through an alias or an edit (below). Two
origins, and the direction of truth differs:

- **Derived** tags are read from the music: `title`, `artist` (and the rest of
  `_x.mnxLab.work`), `tuning` and `capo` from the part-level `strings[]`/`capo`. They are
  **materialised at write time** — on import, and on every accepted edit — into the tags
  table, and are **never typed**. A re-index sweep rebuilds them from the blobs alone. The
  table is a cache of the documents, not a second source of truth.
- **Asserted** tags exist only because a person typed them: lists, genre, setlists. D1 is
  their system of record. Tags an import asserts on the owner's behalf (a Soundslice list
  membership) carry a `source_ref` naming the upstream list, so that after the owner renames
  `unknown:80s` to `genre:80s` the next import sees the list already represented and does
  not resurrect the old row. **An import never deletes a tag**, and a companion missing from
  a later export (a recording removed upstream, a list left) is not a deletion here.

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

Syncpoints belong to the recording, not to a rendition, and reference none. They were
measured against the Soundslice rendition's bar structure, so before enabling synchronised
playback against any rendition the player checks that the rendition's performed-bar count
matches the syncpoint count (allowing the end marker) and refuses with a reason when it
does not — a rendition that unrolls differently is a real finding, not something to paper
over.

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

1. **Blobs are immutable; rows are not.** New bytes are a new rendition row and, if unseen,
   a new R2 key. Nothing in R2 is overwritten by the application. Row metadata — syncpoints,
   filenames, provenance, the pointer — is corrected in place under the piece revision.
2. **One canonical pointer per piece**, and it is the only thing that says which rendition
   is "the document".
3. **Derived tags are a projection** of the canonical rendition seen through the current
   converter; they are never edited and always rebuildable. Asserted tags are data.
4. **Originals are never rewritten.** A correction to metadata is an alias or an edit op on
   the canonical MNX; either way, the uploaded file stands.
5. **Producer, version and options on every rendition**, including the ones third parties
   made (Soundslice's exporter, the CLI that injected its header, an uploader's Guitar Pro).
   When two derived renditions disagree you need to know which side to blame.
6. **Writes are ordered and atomic**: blobs first, then one D1 batch under compare-and-set.
   An import never deletes.

## Out of scope here

- The sync protocol (push/pull, client replica, offline queue) and the DO's internal schema.
- The sharing ladder (URL-fragment, tag-shares, publish tier) and copyright handling at the
  publish moment.
- Auth implementation. The chosen Access/user-table boundary is recorded below;
  provisioning and browser integration belong to campaign item 4.
- Cost. Everything here fits the Workers free plan for development; the $5/mo Workers Paid
  plan is the floor the day real users arrive (the free tier's ceilings are hard daily caps
  that fail writes rather than bill).


## User login boundary (item 4)

The owner selected **Cloudflare Access email codes + 30-day sessions + a users-table
check** on 2026-09-11. The [campaign's item 4 decision](../roadmap/complete/studio-campaign-storage.md#item-4-authentication-decision--2026-09-11)
is the implementation contract. The Worker validates the Access JWT, matches its signed
email to a pre-provisioned active user, and uses the stable user id as storage owner.
There is no public registration or automatic user creation during login. Check user
activity on every library request so disabling a user takes effect before cookie expiry.

Migration `0002_users.sql` adds the pre-provisioned identities table:

```sql
CREATE TABLE users (
  id         TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  email      TEXT NOT NULL UNIQUE CHECK (length(email) > 0 AND email = lower(trim(email))),
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);
```

The first user's id remains `operator`, matching `pieces.owner`, `tags.owner` and
`tag_aliases.owner` for the existing library. Provisioning that identity assigns the
existing pieces without mutating their revisions or rewriting blobs. Email values are
operator-managed account data, not committed seed migrations. Normalize email by trimming
and lowercasing; do not collapse dots or plus-addresses. Existing owner columns remain
logical references; this migration does not rebuild the five application tables.

The owner requested manual provisioning before Access setup. The reusable provisioning
command, edge allowlist synchronization and active-user enforcement are still item 4
work. A users row alone does not enable browser login or enforce suspension: the current
operator API still uses its private token until that integration is deployed.
Access manages browser sessions; no separate studio session store is initially planned.
The private ingest token remains a machine credential, with a scoped Access service
credential planned to keep the operator script working after the edge gate is enabled.


Item 4 implementation and operator commands: [library-access.md](library-access.md).
The Worker derives every browser read owner from a verified Access identity and active
D1 user. Browser and machine audiences are separate; the machine also requires the
write token and active operator. Account rollout verification is tracked in the item.


## Re-derivation sweep (item 5) — retired

Built 2026-09-11 and retired the same day by
[studio-storage-source-canonical](../roadmap/inprogress/studio-storage-source-canonical.md):
with no derived MNX stored there is nothing for a sweep to keep current. Its job — judging
every converter version against every stored source — moved into the ingest tool's
validation mode: `npm run ingest:library` re-validates a slice whenever the projected
tags no longer name the current converter version, prints every schema error per source
per converter, exits nonzero if any conversion failed (having stored everything anyway),
and moves no bytes for a slice the service already holds. `--dry-run` validates the whole
cache without touching the network.
