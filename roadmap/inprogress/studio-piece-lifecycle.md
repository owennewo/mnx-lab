# Living with pieces

> **Status: built 2026-09-17. Needs migration `0005_piece_lifecycle.sql` applied before it is
> deployed** (`npx wrangler d1 migrations apply LIBRARY_DB --remote`). Item 5 of the
> [studio authoring campaign](studio-campaign-authoring.md) and bound by its contract.
> Implementation loop. No golden moved; no verification debt.

## Why

Items 2 and 3 let a piece be made and saved, and every save is kept. But a piece could not
be removed, the kept saves could not be seen or gone back to, and the converter-improvement
loop the campaign promised had half its evidence missing: a lossy save recorded *that* it
lost something, not the document it lost it from.

## What was built

- **Delete, softly; restore, entirely.** `pieces.deleted_at` (migration 0005). A deleted
  piece is *not found* by every read and every write, and nothing — no row, tag or blob — is
  removed. **Delete this piece…** is in the Details sheet, behind an inline confirmation
  that says what it does; unsaved edits are saved first, because a restore brings back what
  was *saved*. The library then offers a one-tap **Undo**, and `#/deleted` lists what was
  deleted with **Restore**. A deleted piece still owns its id: an ingest of that slice is
  refused rather than colliding with it or quietly reviving it.
- **Versions.** `src/storage/versions.ts` reads them off the renditions the snapshot already
  carries — what the piece started as, and every `edit` since, named or automatic, with how
  many things each save could not keep. The Save sheet lists them newest first. **View** puts
  an older version's document on screen under a banner — the save session is told nothing,
  the Details sheet goes read-only with the reason, and the service is not written to — and
  **Make this the current version** moves the pointer.
- **Revert is a pointer move** (`PUT /pieces/:id/canonical`). No rendition is written, the
  version left behind stays, undoing the revert is another revert, and the next checkpoint is
  `derived_from` wherever the pointer is — the lineage branches rather than rewrites. Refused
  unless the caller names what is canonical now.
- **Defect reports.** A checkpoint whose round trip `differs` may carry `evidence` — the
  document the file was exported from — stored as an `mnx` rendition with a fifth role,
  `evidence`, `derived_from` the edit it explains. Sent once per new *kind* of loss per
  session (or never again until it changes), marked reported only when the save lands.
  Evidence that is too big or not valid MNX is noted in the edit's provenance and dropped:
  it must never cost the owner their save. It is never canonical and never a version.
- **The operator pulls them**: two machine routes and `npm run defects:library` (`--list`,
  or `--out <dir>` — refused inside the repository, because this is private music).
- **The projection keeps what only the sidecar knows** — see *Found on the way*.

## Proof

- `harness/conformance/piece-lifecycle.test.ts` (5), over the real routes on local D1/R2
  with a signed identity and the typed client. Deleting hides a piece from browse, facets,
  tag completion, alias counts, its own routes and every write, with row, tag and blob counts
  unchanged, and restoring brings its tags and canonical file back; it is the owner's to
  restore, and an ingest of a deleted slice neither collides nor revives. Reverting moves
  pointer and projection, writes no rendition or blob, can be undone, makes the next edit
  derive from where the pointer is, and is refused on a stale belief, a stale revision,
  another piece's version, evidence, or no title. A lossy save stores its evidence; invalid
  and oversized evidence are noted and dropped with the save standing; the operator's listing
  needs machine credentials, names the losses, serves the bytes, and ignores clean saves. And
  the `kept` rule, below.
- `harness/conformance/save-session.test.ts` (+2): the version list's reading of the rows.
- `harness/verify/piece-lifecycle-smoke.mjs` (`npm run smoke:piece-lifecycle`): in a real
  browser, three versions listed with the named one current; the first looked at — banner,
  its own title, the chip still *Saved*, Details read-only and offering no delete, revision
  and pointer unmoved; back; made current — the pointer on the first rendition, still three
  renditions, the artist tag gone with the version that had it, and the next save derived
  from it; then deleted (404 from the service, gone from the list, the undo bar naming it),
  undone, deleted again and restored from `#/deleted` with all four renditions. Run and
  passed 2026-09-17, with `smoke:save-pipeline` and `smoke:piece-create` re-run after it.

## Found on the way

- **Item 3's tag fallback was wrong, and the browser smoke caught it.** A checkpoint kept the
  library's known title and artist whenever the document had none — meant for Soundslice
  pieces, whose title lives in the sidecar. But it also meant *reverting to a version with no
  artist brought the later version's artist back*, and that **an artist could never be
  cleared**. The rule is now explicit on both sides: only a tag that came from the sidecar is
  kept, it travels marked `kept: true`, and the service carries it over exactly as stored —
  source included — and refuses one it does not already hold. A tag Studio once projected is
  the document's to keep or drop.
- **A snapshot written and a snapshot read must agree.** Adding a column made `writePiece`'s
  returned piece differ from `getPiece`'s by one `null`, and five existing tests compare the
  two. New pieces now carry `deleted_at: null` from the start.
- **Seven test files apply migrations by name.** Each needed `0005`. A shared helper would be
  tidier; each list is deliberate (one suite runs without the users table), so they stay.
- **Looking at a version exposed three small lies**: the subtitle still showed the later
  version's artist, the Details sheet blamed another tab for being read-only, and the frame's
  focus mark sat on the banner's button. All three fixed from the screenshot.

## Not done

- **No thinning of automatic versions** — the campaign's open decision 3. The automatic or
  named mark it will key on is what the version list already reads.
- **Evidence is per session, not per piece.** A new session re-reports a kind of loss it has
  already reported; the blob is content-addressed, so an unchanged document costs a row, not
  bytes.
- **Nothing in Studio can yet produce a lossy save** — the Details sheet offers only what a
  Guitar Pro header holds — so evidence is proved over the route, not in the browser. It
  becomes reachable with item 7.
- **Permanent deletion does not exist**, by the storage contract. If it is ever wanted, it is
  an operator action with its own decision about blobs shared between pieces.
- **Not deployed**, and must not be before the migration is applied.
