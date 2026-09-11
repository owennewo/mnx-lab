# The library, navigable — a rail of dimensions, tags you can edit, aliases that apply

> **Status: built 2026-09-11, in `inprogress/` until the deployed checks pass** (build record at the end). Studio's
> second item, on the shell [studio-shell.md](studio-shell.md) built the same day and the
> source-only library of [studio-storage-source-canonical.md](studio-storage-source-canonical.md).
> Design: the canvas at <https://claude.ai/code/artifact/38c5c7a0-964e-444c-b221-6fe47da09397>,
> **Option A** chosen from four directions, plus the *Piece — Tags sheet* and *Tag aliases*
> boards, which pair with it unchanged. Implementation loop.

## The problem

The library is a flat list with one clever search box. The tag system beneath it —
title, artist, tuning, capo, the Soundslice lists — is what makes a library navigable
("everything in drop D", "everything by this artist") and it is invisible: a filter has
to be typed as `dimension:value`. A piece's tags cannot be seen, added to or corrected
from studio at all. Aliases, the mechanism for correcting a value read from a file
without touching the file, exist in the storage module but have no route and are
applied by no read: they are stored and inert. There is no notion of a favourite or of
what was opened recently, and the list's order is the piece id, which is now an opaque
hash — effectively random.

## Decisions, taken 2026-09-11

- **Option A.** A left rail where every dimension is one line reading `Artist: All`,
  opening to its values with counts; a chosen value stays on the line with an ×. No
  Recent list in the rail: **sort is one click** (Recent · Title · Artist) beside the
  search, so the most recent piece is simply the top row.
- **Recently opened is server-side.** A `piece_views` table (owner, piece, opened at),
  written when a piece page opens, read by `sort=recent`. Works across devices and
  survives a cleared browser; per-browser storage was considered and rejected for that.
- **Favourites are a tag**, `favourite: yes`, asserted like any other, so they filter,
  sync and appear in the rail without a second mechanism. The star toggles it.
- **Soundslice lists ingest under `list`**, not the contract's `unknown`. The nine stored
  pieces are renamed once through the existing rename path.
- **Aliases stay one-dimensional** (`artist: X` shown as `artist: Y`) and become real:
  applied by every read, editable from the Tags sheet and the alias page. A cross-
  dimension alias (`list: Bob Dylan` folded into `artist:`) was designed, argued and
  **rejected for now**: it blurs the line between values read from the music and values
  asserted, acts on a whole list rather than a piece, and the duplicate it would remove is
  cosmetic. Revisit only if the duplicates annoy in use — one nullable column then.
- **Tags read from the music are never edited in place.** The pencil on one creates an
  alias. Your own tags are added, removed and renamed freely; derived dimensions cannot be
  asserted (the module already refuses that).
- **One search box does both jobs.** Words match title and artist; `dimension:value`
  becomes a filter chip, the same chip the rail produces.

## Backend

The storage and the auth are ready; a signed-in browser can only read today. Every write
route belongs to the machine ingest.

1. **Browser writes.** Routes under `/api/library` for the Access-authenticated user,
   through `Library.writePiece(user.id, …)` with the snapshot's revision; 409 means
   re-read. Require a JSON content type as the cross-site guard.
2. **`piece_views`** — migration `0003_piece_views.sql`: `(owner, piece_id, opened_at)`,
   one row per owner and piece, upserted by `POST /pieces/:id/opened`. Documented in
   `docs/studio-storage.md` beside the five tables (the migration-equals-doc test extends).
3. **Effective tags.** One query — tags joined to `tag_aliases` on owner, dimension and
   raw value, the canonical value winning — used by browse, filters, facets and completion.
   The piece snapshot returns each tag with both the stored value and how it is shown.
4. **Facets.** `GET /facets?tag=…` — for the pieces matching the current filters, every
   `dimension:value` with its count. Feeds the rail's lines, its opened lists and the
   "1 of 9 · capo 3" summary. Completion (`GET /tags`) gains counts and a `dimension=`
   parameter — the same query narrowed.
5. **Sort.** `GET /pieces?sort=recent|title|artist`; title and artist reuse the browse
   query's subselects, recent joins `piece_views`. Default `recent`.
6. **Tags on a piece.** `PATCH /pieces/:id/tags` with `add`, `remove` and `rename`.
   `writePiece` gains `remove_tags` (it retains every previous asserted tag today and
   knows only rename). The star is this route with `favourite: yes`.
7. **Aliases.** `GET /aliases`, `PUT /aliases`, `DELETE /aliases` — `setAlias` and
   `listAliases` exist; delete is new. Each alias reports how many pieces it touches.
8. **Ingest.** Lists arrive as `list`; the Worker's "imported lists use the unknown
   dimension" check becomes `list`. A one-off rename of the stored nine.

Unchanged: Access, the canonical read, the source-only storage, the ingest's skip and
validation. No converter is involved anywhere.

## Shell (Option A)

- **Rail**: Favourites; then one line per dimension present in the library (artist,
  tuning, capo, list, and any asserted dimension), `Dimension: All` closed, values with
  counts open, the chosen value held on the line. The dimensions come from the facets
  route, so a new asserted dimension appears without a code change. "Tag aliases" at the
  foot.
- **List**: search with the chip behaviour above; the sort control; rows with title,
  artist, the tuning name, capo and lists as chips, the star, and last opened.
- **Piece page**: a `Tags · n` button in the bar opens the **Tags sheet** — one input with
  suggestions and counts, *Yours* above with removes and quick-add chips, *From the
  music* below, read-only, each row with a pencil that opens the alias editor in place.
  The page posts `opened` on load.
- **Alias page** (`#/aliases`): dimension, read from the file, shown as, pieces, edit and
  delete; an add row.
- Piece URLs and the not-permitted, signed-out and unavailable pages are unchanged.

## Acceptance

- The rail lists every dimension in the library with correct counts under any filter
  combination; choosing a value narrows the list and the counts; × clears it.
- Sort by recent, title and artist; a piece opened just now is the top row on every device.
- A tag added on the Tags sheet is in the rail on return; removing it removes it; the star
  adds and removes `favourite: yes`.
- An alias set from a derived tag changes how that value shows in the rail, the row and
  the sheet on every piece carrying it, and the stored tag is unchanged; the alias page
  lists it with its count; deleting it restores the raw value everywhere.
- The nine stored lists show under `list`; the ingest's replay is still a no-op after the
  rename.
- Worker tests for every route, owner-scoped; the studio smoke drives the rail, a tag add,
  an alias, and the recent sort against local D1.
- `docs/studio-storage.md` carries `piece_views`; `docs/library-access.md` lists the
  browser write routes.

## Out of scope

Cross-dimension aliases (rejected above), editing the music, sharing, sync, and any
change to the workbench.

## Build record

### Backend — 2026-09-11

Built as listed, in one worktree, with two small choices worth recording:

- **Paging is by offset now.** The browse cursor was the piece id, which works only when
  the list is ordered by id — and the id is an opaque hash. With `sort` the cursor is the
  number of rows already seen (`after=50`), opaque to the client as before.
- **The snapshot's tags carry both values.** `GET /pieces/:id` returns each tag with its
  stored `value` and how it is `shown`, applied in code from the alias list; the browse,
  filter, facet and completion reads apply the same aliases in SQL through one
  *effective tags* query. A tag filter therefore matches the shown value, never the stored
  one — filtering by an artist's uncorrected spelling finds nothing once an alias exists.

What is here: migration `0003_piece_views.sql`; `Library` gains `facets`, `recordView`,
`deleteAlias`, `Library.shown`, counts on `listAliases` and `completeTags`, `sort` and
offset paging on `browsePieces`, and `remove_tags` on `writePiece`; routes `GET /facets`,
`GET /pieces?sort=`, `GET /tags?dimension=`, `POST /pieces/:id/opened`,
`PATCH /pieces/:id/tags`, `GET|PUT|DELETE /aliases`, with a JSON-only guard on every
browser write; the ingest names lists `list`; the typed client has a method for each.
Covered by the library and access suites (owner isolation on every new route, the 415
guard, the 409 on a stale revision, aliases applied across browse/filters/facets/
completion, recent-sort ordering, idempotent remove). Docs updated.

**Owner's steps before the shell lands**: `npx wrangler d1 migrations apply
mnx-studio-library --remote` (the views table), deploy, and rename the nine stored lists:
`UPDATE tags SET dimension='list' WHERE dimension='unknown'` — after which the ingest's
replay is still a no-op.

### Shell — 2026-09-11

Option A as drawn, in `apps/studio/src/`: `LibraryPage` (the rail — Favourites, then one
line per dimension the facets know, `Artist: All` closed, values with counts open, the
chosen value held on the line with an ×; the search that takes words or a
`dimension:value`; the one-click sort; rows with title, artist, chips for tuning name,
capo and lists, the star, and last opened), `TagsSheet` (one input with suggestions and
counts, *Yours* with removes and quick-add, *From the music* read-only with the pencil
that opens the alias editor in place), `AliasesPage` at `#/aliases`, and `labels.ts` (the
dimension names, rail order, relative time). The piece page posts `opened` on load, holds
the snapshot, hosts the sheet, and renames itself from the shown title and artist when an
alias lands. The bar gains `Tags · n`. One backend addition rode along: browse returns each
row's chips (shown values in tuning-name, capo and list) so the list needs no per-row
fetch.

Departures from the canvas: the rail hides `tuning` (the pitches — the name says it) and
`title` (the row itself); the row's chips are clickable filters, borrowed from Option C
because they cost nothing. Plain-word search filters the loaded pages client-side and
keeps loading while more exist, which is right at this library's size and is the first
thing to revisit if it ever is not.

Verified: `tsc`, boundaries, the library suites, and the studio smoke end to end against a
local Worker — open a piece, add a tag in the sheet, alias the artist and see the title
and the sheet change, back to the library where the rail shows the alias, the opened piece
is the top row with its chips, a list value narrows the rail and the list, the star
favourites and the Favourites line counts it, sort by title, the alias page lists and
removes the alias.

**Still open — the deployed checks**, then this doc moves to `complete/`:

- [ ] Deploy; in `/studio/`, the rail shows Artist, Tuning, Capo and List with the nine
      pieces' real counts; choosing a tuning narrows the list.
- [ ] Open a piece, add a tag, correct an artist with an alias; the library shows both.
- [ ] Star two pieces; Favourites in the rail reads 2 and filters to them.
- [ ] Sort by Recent puts the piece just opened first, on a second device too.
