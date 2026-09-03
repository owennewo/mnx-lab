# Clean-room gp3/gp4/gp5 reader — the Ultimate Guitar range

> **Status: IN PROGRESS (2026-09-03).** Phase 1 has started: the docs-first field
> notes, bounds-checked little-endian cursor, exact GP3/4/5 version dispatch, and
> the GP5 structural body reader are landed. Generated GP5.00/5.10 fixtures cover
> metadata, measures, tracks, tunings/capo, two voices, notes/rests, dots, tuplets,
> time/key changes, repeats, double bars, markers, beat-text chords, track-level
> lyrics, hammer/pull, palm mute, vibrato, slides, and natural/pinch harmonics;
> both revisions reach EOF and produce MNX exactly equal to AlphaTab. Remaining
> Phase 1 work is the variable-length effect surface (notably bends and graces),
> chord diagrams, mix changes, and tied/dead-note behavior. The third leg of the clean-room Guitar Pro
> converter effort. The first two are landed and green: the GPIF importer
> (`f2752bf` — `.gp`/`.gpx` without alphaTab, held to differential parity) and
> the GPIF writer (`096f792` — held to losslessness through both readers, and
> stricter than alphaTab's own exporter). This doc plans the same method for
> the **legacy binary family** — gp3.00, gp4.00/4.06, gp5.00/5.10, the formats
> *before* the XML era. Naming care: these are not "`.gpx`" (that is GP6's
> container, already handled); they are the flat binary lineage that dominates
> the wild corpus.

Implementation evidence lives in `src/gp345/`, `src/cleanRoom.ts`,
`tests/gp345-*.test.ts`, and
`research/gp-binary-field-notes.md`. The fixture generator is
`converters/fixtures/tools/make-gp5-basics.py`; PyGuitarPro is a fixture-writing
tool only and is not a project dependency. It currently emits a structural pair
and a lyrics/simple-techniques pair in both GP5 revisions.

## Why this range matters

Ultimate Guitar serves **whatever the uploader submitted**, and its catalog was
built in the GP3–GP5 era: the DadaGP scrape of that world (26,181 songs) is
*entirely* gp3/gp4/gp5. Soundslice is the opposite case (fixed `.gpx` export,
already covered). So the clean-room converter's reach today is "modern files
and Soundslice"; this item is what extends it to "the internet's actual corpus
of tab". It is also the last import path still running through alphaTab —
after it, `importGuitarPro` can flip clean-room for every format it accepts,
and alphaTab retires to a dev-time oracle (see *Follow-ups*).

## What is different from the GPIF effort

**Easier — the documentation exists this time.** GPIF had no written spec and
was reconstructed empirically ([research/gpif-field-notes.md](../../research/gpif-field-notes.md)).
The binary family is the opposite: PyGuitarPro's format reference is a
field-by-field de-facto spec, the official Arobas GP4 spec survives (dguitar),
and alphaTab's docs describe the family. This is a **docs-first** build, with
implementations only as tie-breakers.

**Harder — dialect surface and encoding.** Three versions with sub-revisions
(v5.00 vs v5.10 differ by extra bytes in several records), a version-string
dispatch (`FICHIER GUITAR PRO vX.YZ`, length-prefixed), Windows-1252 text in
several Pascal-string encodings (byte-length, int-length, int+byte hybrid),
and per-version bitfield layouts for beat/note effects. And **nothing
maintained writes these formats anymore** — alphaTab included — so fixtures
cannot come from the app; see *Fixtures* for how they are authored instead.

## Method — the proven loop, re-run

### 1. Field notes before code

`research/gp-binary-field-notes.md`, same evidence discipline as the GPIF
notes (CONFIRMED / AGREED / DIVERGENT / OPEN per claim), triangulated from:

| Source | License | Use as |
|---|---|---|
| PyGuitarPro format reference (readthedocs) | docs (code is LGPL, unread) | primary written spec, gp3–5 |
| Arobas GP4 spec (dguitar.sourceforge.net) | official, historical | authoritative for the gp4 core |
| scorelib `model/legacy/` readers+writers | MIT | readable reference; legally portable |
| ruxguitar `gp345/` | Apache-2.0, stated TuxGuitar port | behavioral documentation ONLY — never a porting source |
| alphaTab, observed via `import/gp.ts` | MPL-2.0 (unread) | black-box oracle |

Known traps to pin down in the notes before implementing: the v5.00/v5.10
record deltas; string-encoding selection per field; the bend point list
(binary stores a **full point list**, richer than GPIF's seven floats —
positions 0–60, values in the TuxGuitar-lineage ÷25 units, cross-checking
field-notes §9 row 8); gp5's track/measure padding bytes; where markers,
directions and the double bar live per version.

### 2. Fixtures before the reader

- **Committed, feature-scoped**: small gp5 / gp4 / gp3 files authored
  programmatically with PyGuitarPro — *using* an LGPL library at dev time to
  write bytes copies nothing from it, the same standing as alphaTab writing
  `Sun-did-glide.gp` today. This is the `make-triplets-and-graces` pattern:
  a tool under `converters/fixtures/tools/`, values written longhand in the
  format's own terms, nothing imported from `src/`. Coverage: notes/rests,
  dots, two voices, non-standard tuning + capo, key/time changes, repeats +
  voltas, markers, tempo, tuplets, graces, track-level lyrics with offsets,
  and the technique set (bend point lists, slides, hammer/pull, harmonics,
  palm mute, vibrato, let ring, dead notes).
- **Circularity guard**: each authored fixture must be opened once in a real
  consumer (GP8 imports gp5; TuxGuitar reads all three) before it is
  committed — a fixture the ecosystem accepts, not one that merely satisfies
  the library that wrote it. alphaTab stays the *independent* parity oracle.
- **Not committed — wild-corpus smoke**: a gitignored, script-fetched
  robustness set (DadaGP sample and/or local UG downloads; user transcriptions
  are never committed). Assertions are invariants (parses without throwing,
  measures align, ids resolve), not goldens.

### 3. The reader

`converters/guitarpro-mnx/src/gp345/`:

- `binary.ts` — the cursor: LE integers, the Pascal-string forms,
  `TextDecoder('windows-1252')`, skip helpers that *name* the padding they
  skip.
- `version.ts` — version-string sniff → `{3 | 4 | 5, minor}`; extends
  `sniffContainer`'s existing `gp345-binary` arm (which today refuses with a
  reason — that refusal becomes the dispatch).
- `song.ts` — one reader, version-gated the way the format actually is
  (gp4 and gp5 are layered extensions of gp3), not three forks.
- `normalize.ts` — the key architectural bet: normalize into the **landed
  `GpifDocument` intermediate** and reuse `gpifToMnx` unchanged, so every
  mapping decision (voice slots, tuplet grouping, grace runs, section split,
  harmony dedup, technique targets) exists exactly once. Known impedance to
  absorb: synthesize the id pools; string numbering → GPIF 0 = lowest; a
  points-list bend variant on `GpifBend`; markers → `Section`; the gp5 double
  bar → `doubleBar`. **Decision point, not a debate**: if impedance grows past
  small extensions, fall back to a thin dedicated `gp345 → MNX` mapper — but
  the shared-intermediate shape is the one ruxguitar's single-`Song` design
  validates.
- **Track-level lyrics are the one real algorithm**: gp3–5 store one text blob
  per verse plus a start measure, dispatched onto beats. alphaTab's legacy
  path re-dispatches onto **voice 0, skipping rests** — recorded as finding 4
  of [core-guitar-pro.md](../complete/core-guitar-pro.md) as a place attachment
  is *not* preserved. Mirror it first (parity), then decide whether to keep
  the mirrored quirk or improve on the oracle the way the GPIF writer did.

### 4. Proof

`tests/gp345-parity.test.ts`, same standard as `gpif-parity.test.ts`:
differential structural equality against `importGuitarPro` on the same bytes,
over every committed binary fixture, note-ids normalized as a bijection with
the landed `tests/helpers/normalize.ts`. Where alphaTab's legacy path proves
*lossy or wrong* (the lyric dispatch is already suspect; the writer effort
found two such alphaTab defects in GPIF), do what that effort did: prove the
divergence, choose fidelity, mask the oracle's known loss explicitly in the
test, and record the finding in the field notes.

### 5. Learnings feed back

Every finding lands in `research/gp-binary-field-notes.md` the way the voice
slot and `HarmonicFret` findings landed in the GPIF notes — the notes are the
spec the next reader implements from.

## Phasing — three landings

1. **gp5** (5.00 + 5.10) — the dominant dialect on UG and the richest;
   includes `binary.ts`/`version.ts`/`normalize.ts` and the fixture tool.
2. **gp4** (4.00 + 4.06) — mostly subtraction from gp5 (different chord
   diagram format, fewer effect bytes, no RSE block).
3. **gp3** — single voice, coarser effects; closes the family.

Each phase lands with its fixtures and parity tests green; the wild-corpus
smoke script may land with any phase.

## Scope fences

- **No gp3–5 writing.** Nothing maintained writes these formats (alphaTab
  included); `.gp` is the write format, already clean-room.
- **No `.gtp` (GP1/GP2).** Pre-gp3, vanishingly rare; keep the precise
  refusal.
- **No RSE / page-setup fidelity.** Skipped with named skips; warnings where
  content is musical.

## Follow-ups (named, not filed)

- **The flip** — pointing `importGuitarPro`/`exportGuitarPro` at the
  clean-room paths, regenerating fixtures (note ids move), and demoting
  alphaTab to a devDependency oracle or removing it. Worth its own doc when
  picked up; it can happen **before** this item completes by dispatching
  per-container (clean-room for GPIF, alphaTab for binary in the interim) or
  **after** phase 3 in one move.
- The GP8 diffing worklist (gpif-field-notes §9) is untouched by this item.
