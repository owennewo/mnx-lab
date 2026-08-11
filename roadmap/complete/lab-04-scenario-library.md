# 04 — The Scenario Library

> **Status: complete (closed 2026-08-09).** The structure this doc specified is built,
> enforced, and fully populated against the pinned spec (v27) and extension (v5): 104
> scenarios, feature-def coverage 105 of 108, and every gap that the known spec allows a
> scenario for has one. The corpus keeps growing, but growth no longer needs this doc:
> new spec pins, new proposals and new renderer features open their own roadmap tickets.
> The living operational description is CLAUDE.md's corpus section; this doc remains the
> record of the structure's rationale. Two earlier revisions are visible in git history:
> the original draft and the 2026-06-10 revision that made invalid-by-design scenarios
> first-class and moved identity into paths.
>
> The library is a corpus of small MNX documents that together cover the spec. It is
> simultaneously the renderer's test fixtures, the content of the workbench, executable
> documentation of MNX — and, via its negative scenarios, the evidence base for feedback
> to the MNX Community Group (w3c-cg/mnx#63).

## What a scenario is

A scenario is **one small MNX document (usually 1–2 bars)** that isolates **one feature or
finding**, with sidecar metadata and (once rendered) committed reference outputs.

Design rules, all of which survived contact with reality:
- **Minimal.** Show one thing. A beam scenario has two notes, not a melody.
- **Expectation-explicit, not always valid.** Most scenarios are valid MNX. Some are
  **invalid by design** — they demonstrate something reasonable the spec *cannot* express
  and pin the exact validation errors. For a test bench whose mission is spec feedback,
  these are the most valuable exhibits. Every scenario declares its expected verdicts and
  tests assert both directions: an invalid scenario that *starts passing* after a schema
  bump is a spec-evolution signal.
- **Readable.** A human should understand the JSON at a glance. Prose lives in `notes.md`.
- **Stable.** Once verified, the reference output is committed and changes are reviewed.

## Two namespaces: `spec/` and `lab/`

The corpus has two halves with opposite ownership models, and the path makes that explicit:

- **`scenarios/spec/`** — a mirror of the MNX spec's own worked examples (52 documents,
  read from the pinned `vendor/mnx` submodule — see
  [docs/mnx-spec-submodule.md](../../docs/mnx-spec-submodule.md)). **Never hand-edited**;
  `harness/verify` tooling and `spec/tools/sync-spec-examples.mjs` (`npm run sync:spec`)
  own the whole tree, keep upstream names verbatim, and *generate* each `meta.json`
  (including `coversDefs` from the spec's own example↔object join). Mirroring bought
  instant breadth, the most credible renderer metric possible, and a tripwire for
  upstream changes on every resync.
- **`scenarios/lab/`** — ours, hand-authored: the tab scenarios, the invalid-by-design
  exhibits, edge cases, proposed-schema probes, and the minimal teaching examples the
  spec set lacks.

## Folder layout

```
scenarios/
  manifest.json                  # corpus contract: schema version (27), extension
                                 # version (5), category titles, the plumbing-defs
                                 # coverage exclusion list, spec/ attribution
  meta.schema.json               # JSON Schema for meta.json (metadata is validated too)
  spec/                          # mirrored — DO NOT EDIT; sync:spec owns it
  lab/                           # hand-authored
    <NN-category>/<NN-scenario>/
      meta.json                  # hand-written metadata
      score.mnx.json             # the exhibit — pristine MNX, canonical 2-space format
      expected.primitives.json   # layout snapshot; absent for invalid documents
      expected.svg               # emitter golden (+ expected.tab.svg and
                                 # expected.both.svg for tab-opting scenarios)
      notes.md                   # optional prose: what's interesting, spec quotes
```

`scenarios/` is **self-contained** (manifest + meta schema live inside it) so it can be
promoted to an `mnx-scenarios` package later without surgery. The promotion trigger is a
real external consumer needing to install it — a check, not a debate — and it has not
fired.

## Identity: derived from the path, numbers are sort-only

A scenario's id is its path **with numeric prefixes stripped**:
`scenarios/lab/25-tab-techniques/01-bend-and-release/` → `lab/tab-techniques/bend-and-release`.
`meta.json` contains no `id` and no `category` — nothing to drift from the filesystem;
renumbering for pedagogy never changes identity; recategorizing is a `git mv` that
changes the id honestly.

## `meta.json`

The authoritative schema is `scenarios/meta.schema.json`. The axes that matter:

- **`expect`** carries *two* verdicts — standard MNX and the `_x.mnxLab` extension —
  matching the dual validation in the worker. `errors` (required iff invalid) pins
  fragments that must match actual validation errors, both directions.
- **`origin`**: `mirrored` | `local` — the ownership boundary above.
- **`schema`**: `published` (default) | `proposed` — which schema judges
  `expect.standard`; `proposed` names its `proposal` topic under `spec/proposals/`.
- **`coversDefs`** — the coverage axis (below).
- **`status`**: `draft` → `valid` → `rendered` → `verified`; only `verified` is a human
  assertion, written solely by `harness/verify/verify-scenarios.mjs` with a provenance
  record. `npm run update:primitives` recomputes the middle rungs and keeps them honest.

## Coverage: measured against the schema's `$defs`

MNX v27 defines 193 `$defs`. The feature-def denominator excludes **plumbing** — the
structural skeleton, scalar/utility types, and aggregate wrappers (both the `*-list`
defs and the plain plurals like `systems` whose singular item def is the real feature).
The exclusion list is data in `manifest.json`, consumed by both
`harness/verify/check-scenarios.mjs` (which prints the uncovered list — the backlog) and
the workbench's `#/objects` coverage map (`src/corpus/plumbingDefs.ts`), so the checker
and the UI can never disagree about the denominator.

**Closing state: 105 of 108 feature defs covered.** The three uncovered, each deliberate:

- `line-type` — slur/tie line styling; the renderer draws every slur solid, so a
  scenario would pin nothing. Author it when line styles land.
- `slur-tie-end-location` — an **orphan def**: nothing in the published schema
  references it. Unexercisable by any document; itself a candidate upstream report.
- `smufl-font` — an alternative-font declaration; the engine deliberately bundles
  Bravura only.

## The categories as built

`lab/` (18 categories; titles in `manifest.json`, rail grouping in
`src/corpus/groups.ts` — a display concern, deliberately not corpus data):

| # | Category | Covers |
|---|----------|--------|
| 00 | document | minimal single note; the empty tab canvas template |
| 01 | pitches | parenthesized courtesy accidentals |
| 10 | durations | the rest gallery |
| 11 | rhythm | appoggiatura; tuplet number suppression; sequence spaces |
| 20 | tab-part | tuning/capo/staffKind declarations |
| 21 | tab-positions | annotated fingerboard positions |
| 22 | tab-derivation | the derivation ladder: bare notes, string-only, capo, drop D, mismatches, out-of-range, undeclared strings |
| 23 | tab-fingering | left hand 1–4, right hand p-i-m-a |
| 24 | tab-spec-gaps | **invalid-by-design exhibits**: TAB clef, note position, tuning/capo, fingering, harmony — each pinning the exact rejection the spec produces today |
| 25 | tab-techniques | bends as curves, shift/legato slides, hammer/pull chains, vibrato, palm mute, natural harmonics |
| 30 | dynamics | mark gallery; prefix/suffix accents; wedges + relative dynamics |
| 31 | score-text | rehearsal marks, sections, directions (proposed schema, topic `score-text`) |
| 32 | articulations | the rare drawn four (staccatissimo, stress, unstress, soft accent); the undrawn three (spiccato, breath, bow direction); fermata; arpeggio/non-arpeggio |
| 40 | navigation | jumps and signs |
| 50 | lyrics | verse labels, syllable types |
| 60 | layout | group barline styles |
| 70 | percussion | the minimal kit |
| 90 | edge-cases | per-voice bar-duration mismatches (grows as findings surface) |

Where `lab/` overlaps the spec's own example clusters, names align; where it diverges —
tab, negative exhibits, percussion — the divergence *is* the finding: the spec's 52
examples contain nothing on tablature, nothing invalid-by-design, and no percussion.

A deliberate authoring stance in the late categories: scenarios whose feature the
renderer does not draw yet (techniques, fingering, fermatas, wedges, kits) are still
authored, with goldens pinning the *current* honest output and a description naming the
gap. When the feature lands, `update:primitives` demotes exactly those scenarios back
into the attention queue — the corpus is the tripwire for its own future.

## Reference outputs

The primary machine artifact is **`expected.primitives.json`** — deterministic,
font-independent, meaningful diffs, Node-native. `expected.svg` (+ `expected.tab.svg`)
pin the emitter (codepoints, emit branches, sp→px, viewBox), and `expected.both.svg`
pins the combined notation+tab system. All text, never pixels; scale is a power of two.
The full rationale lives in CLAUDE.md's corpus section and
`harness/helpers/corpusSvg.ts`.

## How the library is consumed

- **Workbench:** `import.meta.glob` — tree from paths, facets from metadata, the
  attention queue from committed provenance, `#/objects` from the inverted
  `coversDefs` join.
- **Tests (root vitest):** every scenario's verdicts asserted both directions;
  primitives and SVG goldens snapshot-compared; `groups.test.ts` asserts the rail
  grouping stays total and non-empty.
- **Harness scripts:** `check-scenarios` (the corpus police + coverage report),
  `verify-scenarios` (the only status/provenance writer, driven by `/verify`),
  `update:primitives` (golden regeneration with honest status transitions),
  `sync:spec` (the mirror).

## Considered and rejected

- **Defs as the organizing structure.** Right coverage axis, wrong shelf arrangement:
  most defs are plumbing, the mapping is many-to-many, and the most valuable scenarios
  (extension, invalid, edge cases) have no def at all.
- **Embedding metadata in the document.** The document is the exhibit: CG-facing
  examples must show pristine MNX, and invalid-by-design documents need byte-exact
  control over *why* they're invalid.
- **`expected.svg` ruled out as "the same fact twice."** Reversed mid-project — the
  emitter needed its own witness; the churn fear was answered with a fixed
  power-of-two scale.
- **A deep tree.** Two levels is a filing convention, not a data structure; the model
  stays flat and facet-driven.
- **Assuming an instrument.** Rejected everywhere, permanently: absent `strings[]`
  means no fingerboard. A declared fingerboard is data; a guessed one is a lie waiting
  to render.
