# The library, navigable — a rail of dimensions, tags you can edit, aliases that apply

> **Status: proposed 2026-09-11.** Studio's second item, on the shell
> [studio-shell.md](../inprogress/studio-shell.md) built the same day and the source-only
> library of [studio-storage-source-canonical.md](../inprogress/studio-storage-source-canonical.md).
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
