# Clean-room gp3/gp4/gp5 reader — the Ultimate Guitar range

> **Status: IN PROGRESS — UNLANDED WORKTREE HANDOFF (2026-09-08).**
> The last implementation checkpoint on main is `4bd5d48`; the additional
> GP3/4 reader, expanded effects/ties, browser integration and public clean-room
> API switch are checkpointed on the task branch, not main. The fixture-serialization
> failures are resolved and pre-rebase gates pass; coverage review and landing
> remain outstanding. See the
> current handoff below; resume there, not from the historical checklist.
>
> **Landed baseline (not the current worktree):**
> Phase 1 (GP5) is partly complete: the docs-first field notes, bounds-checked
> little-endian cursor, exact GP3/4/5 version dispatch, and GP5 body reader are
> on `main`. Generated GP5.00/5.10 fixtures cover
> metadata, measures, tracks, tunings/capo, two voices, notes/rests, dots, tuplets,
> time/key changes, repeats, double bars, markers, beat-text chords, track-level
> lyrics, hammer/pull, palm mute, vibrato, slides, and natural/pinch harmonics;
> both revisions reach EOF and produce MNX exactly equal to AlphaTab. Remaining
> Phase 1 work is the variable-length effect surface (notably bends and graces),
> chord diagrams, mix changes, and tied/dead-note behavior. The production
> `importGuitarPro` entry point remains AlphaTab-backed until the legacy family
> is broad enough for the explicit follow-up flip.

This is the third leg of the clean-room Guitar Pro converter effort. The first
two are landed and green: the GPIF importer
(`f2752bf` — `.gp`/`.gpx` without alphaTab, held to differential parity) and
the GPIF writer (`096f792` — held to losslessness through both readers, and
stricter than alphaTab's own exporter). This doc plans the same method for
the **legacy binary family** — gp3.00, gp4.00/4.06, gp5.00/5.10, the formats
*before* the XML era. Naming care: these are not "`.gpx`" (that is GP6's
container, already handled); they are the flat binary lineage that dominates
the wild corpus.

Implementation evidence lives in `src/gp345/`, `src/cleanRoom.ts`,
`tests/gp345-*.test.ts`, and
`research/gp-binary-field-notes.md`. The fixture generator is
`converters/fixtures/tools/make-gp5-basics.py`; PyGuitarPro is a fixture-writing
tool only and is not a project dependency. It currently emits a structural pair
and a lyrics/simple-techniques pair in both GP5 revisions.

## Session handoff

### Current restart point — 2026-09-08

Resume branch `core-guitarpro-binary-import` in
`/home/williao/dev/mnx-labs-worktrees/core-guitarpro-binary-import`, based on
`f2e2065`. The user authorized takeover of this existing worktree. Do not
recreate it or discard its files: source edits, generated binary fixtures
and tests belong to the task branch's expanded-reader checkpoint. The inherited prototype is preserved in stash
`1399be56e2681d274c77ce856c32113c90955eda`; only its `Binary-suite` fixtures
and generator were restored, not its parser.

Current worktree coverage (fixture-proven, **not full format support**):

- Shared binary dispatch for GP3.00, GP4.00/4.06 and GP5.00/5.10;
  older structural fixtures and recovered GP3/4 suites match the oracle.
- GP5 full bend point lists and simple grace expansion. Grace tests explicitly
  prove and correct the oracle's loss of authored duration/on-beat placement.
- Old/new chord records, beat-effect traversal with warnings, and tempo/mixer
  records have parity fixtures for all five revisions.
- Tied-pitch resolution and MNX tie links pass five revision fixtures;
  dead-note styling warns. Tests explicitly prove and correct the existing
  AlphaTab-backed mapper's missing `n0 → n1 → n2` links. Five further
  intermediate-level regressions prove an inserted same-string grace cannot
  steal the tie origin; sources are retained by ID, per track/voice/string.
- The converter's public `importGuitarPro` and `exportGuitarPro`, and therefore
  the CLI, now use the clean-room reader and GPIF writer (unlanded).
  The workbench worker also uses the clean-room reader, preserving
  title/artist metadata. Its built artifact imports all 73 fixtures without
  Node globals or AlphaTab via `smoke-gp-worker.mjs`.

GP4/5 artificial/tapped/semi harmonic records now parse. Four new fixtures
cover octave harmonics with capo; GP5 artificial/tapped pitch differences from
AlphaTab are explicitly asserted and corrected in parity tests (field notes
§10). This does not prove every node, artificial octave/pitch combination, or
GP4 discriminator: broaden those fixtures next. GP3 beat-level vibrato and
natural/artificial harmonics now have a two-note-per-beat fixture, with an
explicit correction for the oracle's lost vibrato; other fields match exactly.
Tie-target ID normalization is implemented; add dedicated rest/voice and
harmonic-tie fixtures before claiming complete ties.

Legacy ending normalization now has ten fixtures covering third endings,
grouped endings, multi-bar spans and repeat-group resets. Tests explicitly
document two oracle discrepancies (field notes §12).
Then cover richer graces, complex lyric syntax, and malformed
records. Bass/percussion multi-track fixtures now pass exact parity in all five
revisions, including bass clef and drum MIDI pitch without fictitious strings.
Matching grace records now normalize to simultaneous grace chords, and mixed
before/on-beat groups retain their distinct placement. Five chord fixtures and
one shared-mapper regression cover this. GP3/4 chord fixtures expose a writer
discrepancy (field notes §15): stored 16th/bend, despite the writer's public
32nd/hammer round trip. Five separate explicitly authored grace-hammer
fixtures now prove independent same-string targets in every revision, with
TuxGuitar confirming the wire fields (field notes §18). Wider grace
transition/duration fixtures remain needed.
Percussion grace expansion now retains its stored MIDI key instead of losing
the pitch through a stringless fret. Five new two-track revision fixtures prove
C2 grace → D2 principal with no tab data; TuxGuitar independently confirms the
stored grace fields (field notes §17). The generator explicitly authors the
documented grace record to avoid the older writer discrepancy noted above.
Legacy lyric tokenization now covers unspaced syllable hyphens, plus-joined
words, bracketed comments and repeated-space skipped-note slots, with exact
GP4/5 oracle fixtures across a barline (field notes §16).
The previous **68 binary fixtures** were accepted through installed
TuxGuitar's public reader API using the new dev-time
`converters/fixtures/tools/check-binary-tuxguitar.py`; it prints SHA-256 hashes
and track/measure counts. This is real-consumer parser acceptance, not visual
engraving approval or comprehensive fidelity proof. Re-run it as fixtures change.
The five percussion-grace and five explicit grace-hammer fixtures also pass,
bringing accepted binary fixtures to 78. A fresh root build and browser smoke
now pass the expanded 83-file set (78 binary plus five modern files).
The new `converters/fixtures/tools/smoke-gp-binary.mjs` fetches a pinned
32-score GP5 classical sample into gitignored `.gp-corpus/` (`--fetch` once,
then offline). It now passes **32/32** structural checks after handling
the optional final GP5 layout byte and orphan ties. AlphaTab's public model
confirms the failing tie has no cross-voice source; recovery retains its stored
fret without a link, with an explicit warning and five revision tests.
See field notes §§13–14 for the pinned source, evidence and test limits.
**Next:** finish the documented remaining grace/harmonic edge fixtures and
older-dialect/multi-track wild coverage, then review and land. The recovered
GP5 `Binary-suite` now passes whole-document parity after the already-proven
grace-duration correction. Every incomplete prefix of the five structural
fixtures is tested (except the valid GP3 trailer and terminal GP5 layout-byte
omissions), and extra trailing bytes are rejected. Seven further tests mutate
every observed labelled structural count and GP5 bend-point count to negative
and overflowing values, requiring controlled rejection. Broader flag fuzzing
and corpus coverage remain open.

Runtime-flip progress: the workbench worker uses `importGuitarProWithMetadata`,
and the root manifest no longer depends on AlphaTab. GPIF container inflate now
uses browser-compatible `fflate`; a portable CRC-32 implementation matches
Node and the standard test vector. Both binary and GPIF parsers retain heading
metadata outside MNX. The built-worker smoke checks its source map excludes
AlphaTab/zlib and imports 83 fixtures in a VM context without Node globals;
this is artifact validation, not a visual browser UI test. The converter facade
now exports the clean-room functions and AlphaTab is a **devDependency only**.
Parity tests explicitly import the historical AlphaTab modules as their oracle;
public import/round-trip tests exercise the new facade. `buildScore` and
`scoreToMnx` are no longer public exports; the migration is documented in
`converters/guitarpro-mnx/README.md`. The repeatable
`converters/fixtures/tools/smoke-gp-package.mjs` packs and installs with
`--omit=dev` outside the workspace, asserts AlphaTab is absent, and passes
public import/export checks on seven fixtures spanning all five legacy
revisions plus GPX and modern GP. The latest isolated installation is retained
at `/tmp/mnx-gp-package-FAXDra` for inspection.

The switch exposed and fixed GPIF tempo-reference decoding: 90 dotted-quarter
BPM must become 135 quarter BPM. Four derived MNX fixtures were regenerated
through the clean-room CLI (House-of-the-Rising-Sun, Sun-did-glide, Vestapol,
Triplets-and-graces). An ID-normalized deep comparison against HEAD proves
these changes are ID-only. Their four derived XML fixtures were regenerated
through the MusicXML CLI; comparison against HEAD proves those differ only
in IDs and encoding dates. No serializer assertions were weakened.

Verification: the full converter run now passes **222/222 tests**, including
the five grace-source regressions. The converter TypeScript build and
`git diff --check` pass. Do not interpret
the historical green counts below as the current result. Root tests now pass
**1,218/1,218**, `check:scenarios` passes for 121 scenarios, and the root build
passes **after the final public-facade/fixture switch**. The subsequent
MusicXML suite now passes **107/107** after regenerating the stale derived XML.
The chained root tests, scenario check and build all ran and passed again.
Both converter TypeScript builds pass, the freshly rebuilt browser worker
passes all 83 fixture imports, and the production-only package smoke passes.
These are all pre-rebase results; post-rebase gates and landing remain
outstanding, as do the feature/corpus tasks above.
Keep this doc in `inprogress/`; retain the worktree because it holds the only
checkout of the unlanded implementation. The checkpoint is not a completion
claim; preserve the remaining coverage items and rebase/gate before landing.

Restart commands (from that worktree):

```sh
git status --short
npm test --workspace @mnx-editor/guitarpro-mnx -- --run tests/gp345-ties.test.ts
npm test --workspace @mnx-editor/guitarpro-mnx
npm run build --workspace @mnx-editor/guitarpro-mnx
npm test --workspace @mnx-editor/musicxml-mnx
node converters/fixtures/tools/smoke-gp-package.mjs
node converters/fixtures/tools/smoke-gp-binary.mjs
# After a fresh root build:
node converters/fixtures/tools/smoke-gp-worker.mjs
git diff --check
```

Before landing: review the remaining fidelity/coverage gaps above,
commit the worktree, fetch/rebase onto current `origin/main`, and run every
required landing gate in CLAUDE.md (including primitives if the rebase touches
model/engine/scenarios). Fast-forward and push only once green. Main has moved
since this branch's `f2e2065` base; do not treat old gate results as landing
evidence. Keep the item in `inprogress/` until shipped and the worktree retired.

### Historical checkpoints — superseded by the restart point above

**Further continuation (2026-09-08, unlanded):** old/new chord diagrams now
parse in all five revisions and retain chord names as harmony. Beat-effect
records (fade-in, brushes, slap/tap, tremolo bars) traverse with explicit
warnings for unsupported musical data. Mix-table changes retain tempo and
warn for unsupported mixer controls. Fifteen new revision-specific tests
assert exact AlphaTab parity on generated files. Ties/dead notes, richer
harmonics/graces, real-consumer validation, corpus smoke, runtime dispatch
and full landing gates are still outstanding.

**Continuation (2026-09-08, unlanded):** `parseGuitarProBinary` now shares the
structural reader across GP3.00, GP4.00/4.06 and GP5.00/5.10. The clean-room
dispatcher selects it for all recognized binary versions; the GP5-specific API
still rejects older versions. New structural fixtures for all three older
revisions and the recovered GP3/GP4 feature suites match AlphaTab exactly.
The reader accepts the observed GP3 zero-integer trailer and populated beats
whose status is zero. Remaining work includes chord diagrams, beat/mix effects,
ties/dead notes, richer harmonics/graces, real-consumer fixture validation,
wild-corpus smoke and all landing gates. Production import still uses AlphaTab.

**Continuation in progress (2026-09-07):** the user authorized takeover of the
existing `core-guitarpro-binary-import` worktree. Its inherited prototype is
preserved in stash `1399be56e2681d274c77ce856c32113c90955eda`; the worktree was
rebased onto current `main`. Only the older fixture files and generator have
been restored; the prototype parser remains in the stash for reference.
New worktree changes add complete bend point lists and GP5 grace expansion,
with paired 5.00/5.10 fixtures. All 129 converter tests pass. Grace parity
explicitly accounts for AlphaTab losing duration and on-beat placement (see
the field notes). These changes are not landed yet. Continue the remaining
GP5 records, richer grace cases, GP4/GP3 dialects and completion gates below.

Landed checkpoint: **`4bd5d48` — “Add clean-room GP5 binary reader”.** At that
commit, the converter package has **125 passing tests**, and its TypeScript build
and `git diff --check` pass.

Landed checkpoint callable boundary (not the expanded worktree):

- `importGuitarProCleanRoom` imports the fixture-proven GP5.00/5.10 subset and
  dispatches GP6–GP8 containers through the existing clean-room GPIF reader.
- GP3 and GP4 are recognized by exact version but still fail with a deliberate,
  version-specific “not implemented” error.
- `importGuitarPro` and the CLI/browser production surfaces still use AlphaTab.
  AlphaTab therefore remains a runtime dependency as well as the parity oracle.
- Unsupported GP5 variable records fail at their musical location and byte
  offset. Unrepresentable fixed flags warn; they are not silently discarded.

Progress checklist:

- [x] Binary cursor, Windows-1252 strings, strict bounds and version sniffing.
- [x] GP5.00/5.10 preamble, measure headers, tracks and exact EOF traversal.
- [x] Two voices, notes/rests, dots, tuplets, repeats, markers and beat text.
- [x] Track-level lyric redistribution with offsets, hyphenation and rest skipping.
- [x] Hammer/pull, palm mute, vibrato, slides, natural/pinch harmonics and
      sounding-pitch parity.
- [ ] Finish GP5 variable records and note types.
- [ ] Implement GP4.00/4.06, then GP3.00, each with revision fixtures and parity.
- [ ] Run a non-committed wild-corpus smoke and harden malformed-input behavior.
- [ ] Flip production import dispatch and remove AlphaTab from runtime dependencies.

**Original next slice (now implemented in the unlanded worktree):** add paired GP5.00/5.10 fixtures for bend point
lists and grace notes, then extend `gp5.ts` and the shared `GpifDocument`
intermediate only as far as those fixtures require. Preserve complete bend curves
(positions 0–60, values converted to MNX semitones), grace placement/duration, exact
normalized AlphaTab parity, and exact EOF consumption. After that, take chord
diagrams/beat effects/mix changes and tied/dead notes as separate bounded slices.

Restart verification commands:

```sh
npm test --workspace @mnx-editor/guitarpro-mnx
npm run build --workspace @mnx-editor/guitarpro-mnx
git diff --check
```

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
