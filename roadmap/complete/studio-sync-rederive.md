# Sync first, bars later

> **Status: built 2026-09-17; complete 2026-09-20.** The owner closed it with the two hands-on
> checks below still in progress — testing continues on the live site, and a finding reopens
> nothing here: it is a defect against the built thing. Item 4 of the
> [studio authoring campaign](../inprogress/studio-campaign-authoring.md), bound by its clause 10 — *the
> segments are the sync; the tuples are a cache*. Implementation loop. No golden moved; no
> verification debt.

## Why

The priority flow is *new piece → YouTube → sync*, with the notes written afterwards. A sync
made in the sync bar is stored as its **segments** (cuts, beats, tempo) with Soundslice-shaped
**tuples** beside them, derived from the segments and the score's bars at the moment of the
edit. The player played by the tuples. So a sync made on a four-bar skeleton stopped
following at bar four however many bars were written later, until someone happened to touch
the sync bar again. The owner asked exactly this — *"hasn't my three cutpoints been changed
into something else?"* — and the honest answer was: no, but what plays is not them.

## What was built

- **`playingSyncpoints(source, barBeats, mediaEnd?)`** (`src/model/syncSegments.ts`) — the
  rule in one pure function. Segments present: derive from them against the bars *as they
  are now*, and do not consult the stored tuples; no bars yet is *not synchronised*, never
  yesterday's tuples. No segments (an import), or segments that do not decode: the stored
  tuples, which are all the evidence there is.
- **The player plays by it** (`src/elements/Player.ts`). Its source factory — which runs
  again for every new performance, so every change to the bars — derives instead of reading
  `source.syncpoints`. `refreshDerivedSync` derives once more when the media's length
  becomes known, because an open last segment runs to the media's end, and swaps the map in
  place. When what plays is not what is stored it emits **`sync-refresh`**, the same detail
  as `sync-edit`; the sync bar's own commits speak for themselves while it is open.
- **Studio writes the refreshed cache back** (`apps/studio/src/PiecePage.ts`) through the
  path a sync edit already takes — debounced, in the page's one write queue, retried once on
  a moved revision — and not at all from a read-only tab. The echo neither re-cues the
  source nor causes another write.
- **An imported sync carries the shape it was good for.** `performedShape`
  (`src/audio/scoreShape.ts`): each performed bar's length, run-length encoded — `12x1/1`,
  `11x1/1,1x1/2`. It moves when a bar is added, a meter changes or a repeat is performed, and
  not when the music inside the bars does. The recording route takes a `scoreShape` that is
  merged into the provenance **whatever else it holds** (an ingested recording may hold
  nothing), leaves the tuples alone, is a no-op when unchanged, and is forgotten by a new
  sync. Studio stamps an unstamped imported sync on first sight; the Source sheet says *may
  be out of date* for one stamped with another shape, and explains the way out on the
  playing one.

## Proof

- `harness/conformance/sync-rederive.test.ts` (8), over real documents and the real
  performance compiler: a sync made on 4 bars follows all 12 of the score it is opened on
  (full coverage, the 13th point at 26 s) while its stored tuples give *partial*; a changed
  meter puts the bars on the same beats; no bars is *not synchronised*; the media's length
  bounds an open last segment; imports and undecodable segments fall back to stored tuples;
  and the shape's three properties above, plus reading it from any provenance.
- `harness/conformance/recording-management.test.ts` (+1): the stamp merges into an existing
  provenance without touching the sync, costs nothing when unchanged, is cleared by `null`
  and forgotten by a new sync, is bounded, and stands alone on a recording with no
  provenance.
- `harness/verify/sync-rederive-smoke.mjs` (`npm run smoke:sync-rederive`; the sync-bar
  smoke's recipe — production Studio, a fixture client, real PCM). A six-bar score with three
  recordings: the never-opened import is stamped `6x1/1`, once, its tuples untouched; the
  Studio take whose stored tuples stop at bar 3 is **anchored to the end of bar 6 at 13 s**
  and its seven refreshed points are written back with the segments unchanged; the echo
  causes no second write and does not re-cue; the Source sheet reads *follows the whole
  score* for those two and *may be out of date* for the one stamped `4x1/1`. Run and passed
  2026-09-17, as was `smoke:sync-bar` after the player change.

## The hands-on checks — not a machine's, and not a gate

The campaign folded [studio-sync-bar](studio-sync-bar.md)'s two outstanding checks into this
item. Neither can be made from here, and neither is claimed by this doc. **On 2026-09-20 the
owner marked the item complete with both still open**, to keep testing on the live site rather
than hold the campaign on them:

- **The click against a real YouTube clock** — a judgement by ear, on a real video.
- **The sync bar on touch** — its 16 px segment-label targets, on the tablet.

They are best made on a piece created with item 2, which is the first time the flow can be
walked end to end: *New piece → Add recording (YouTube) → Sync bar*. Both can be walked
locally — YouTube plays under `wrangler dev` — so nothing about them needs the deployment.

## Not done here

- **Stamping assumes the sync is good when first seen.** An import that was already wrong
  before Studio first opened it is stamped with the wrong score's shape; the recording sync
  map's own diagnostics (partial coverage, dropped points) remain the only signal for that.
- **No way to import a sync.json in Studio**, so the only imported syncs are the operator
  ingest's; when the Recordings sheet grows an import it should send the shape with it.
- **Nothing in Studio can change the bars yet** (item 7). Every part of this is exercised by
  opening a score whose bars differ from the ones a sync was made on, which is the same
  thing seen from the other side.
