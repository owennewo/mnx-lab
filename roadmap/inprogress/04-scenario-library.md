# 04 — The Scenario Library

> **Stability: agreed structure (revised 2026-06-10).** This revision supersedes the original
> draft after the tab-extension v2 work. Key changes: invalid-by-design scenarios are
> first-class; the corpus splits into a `spec/` mirror and a `lab/` namespace; identity is
> derived from paths; the committed reference artifact is the primitive list, not SVG;
> coverage is measured against the schema's `$defs`, not asserted by the taxonomy.
>
> The library is a corpus of small MNX documents that together cover the spec. It is
> simultaneously the renderer's test fixtures, the content of the gallery app, executable
> documentation of MNX — and, via its negative scenarios, the evidence base for feedback to
> the MNX Community Group (w3c-cg/mnx#63).

## What a scenario is

A scenario is **one small MNX document (usually 1–2 bars)** that isolates **one feature or
finding**, with sidecar metadata and (once rendered) a committed reference output.

Design rules:
- **Minimal.** Show one thing. A beam scenario has two notes, not a melody.
- **Expectation-explicit, not always valid.** Most scenarios are valid MNX. Some are
  **invalid by design** — they demonstrate something reasonable the spec *cannot* express
  (e.g. a TAB clef) and pin the exact validation errors. For a test bench whose mission is
  spec feedback, these are the most valuable exhibits, so they are first-class citizens, not
  forbidden. Every scenario declares its expected verdicts and tests assert both directions:
  an invalid scenario that *starts passing* after a schema bump is a spec-evolution signal.
- **Readable.** A human should understand the JSON at a glance. Prose lives in `notes.md`,
  not the JSON.
- **Stable.** Once verified, the reference output is committed and changes are reviewed.

## Two namespaces: `spec/` and `lab/`

The corpus has two halves with opposite ownership models, and the path makes that explicit:

- **`scenarios/spec/`** — a mirror of the MNX spec's own worked examples
  (≈49 documents at `w3c-cg.github.io/mnx/docs/mnx-reference/examples/`). **Never hand-edited**;
  `scripts/sync-spec-examples.mjs` fetches them, keeps upstream names verbatim, and
  *generates* their `meta.json` (source, upstream URL, auto-tags). Mirroring the spec's own
  examples buys instant breadth, the most credible renderer metric possible ("renders N/49 of
  the spec's own examples"), and a tripwire for upstream changes on every resync.
- **`scenarios/lab/`** — ours, hand-authored: the tab-extension scenarios, the
  invalid-by-design exhibits, edge cases, and minimal teaching examples the spec set lacks.

## Folder layout

```
scenarios/
  manifest.json                  # corpus contract: MNX schema version tested (19),
                                 # tab extension version (2), category titles,
                                 # upstream source + license attribution for spec/
  meta.schema.json               # JSON Schema for meta.json (metadata is validated too)
  spec/                          # mirrored — DO NOT EDIT; the sync script owns it
    hello-world/
    beams/
    slurs/
    ...
  lab/                           # hand-authored
    00-document/
      01-minimal-single-note/
        meta.json                    # hand-written metadata (schema below)
        score.mnx.json               # the exhibit — pristine MNX, canonical 2-space format
        expected.primitives.json     # generated layout snapshot; absent until rendered,
                                     # absent for invalid documents
        notes.md                     # optional prose: what's interesting, spec quotes
    20-tab-part/
    24-tab-spec-gaps/
    90-edge-cases/
```

`scenarios/` is **self-contained** (manifest + meta schema live inside it) so it can be
promoted to an `mnx-scenarios` package later without surgery — but it starts as a plain
directory. Promotion happens when something external actually wants to install it, not before.

## Identity: derived from the path, numbers are sort-only

A scenario's id is its path **with numeric prefixes stripped**:

```
scenarios/lab/00-document/01-minimal-single-note/  →  lab/document/minimal-single-note
scenarios/spec/beams/                              →  spec/beams
```

Consequences, all deliberate:
- `meta.json` contains **no `id` and no `category`** — nothing to drift from the filesystem.
- Numeric prefixes exist purely as filesystem sort keys; renumbering for pedagogy never
  changes identity or breaks a gallery permalink.
- Recategorizing is a `git mv` (the id changes honestly — it *is* a different shelf).

## `meta.json` schema (sketch — authoritative version in `meta.schema.json`)

```jsonc
{
  "title": "Open E-major chord with explicit positions",
  "description": "One chord event; every note carries _x.tab.position; no two notes share a string.",
  "bars": 1,
  "tags": ["chords", "tab:position"],
  "specRefs": ["https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/note/"],
  "coversDefs": ["event", "note", "pitch"],   // schema $defs exercised → drives coverage report
  "expect": {
    "standard": "valid",                       // verdict vs the official MNX schema
    "extension": "valid",                      // verdict vs the _x.tab schema ("n/a" if unused)
    "errors": []                               // required iff invalid: fragments errors must match
  },
  "requires": ["tab-positions"],               // renderer capabilities exercised
  "idRefs": false,                             // exercises cross-referencing? (cross-cutting facet)
  "source": "hand-written",                    // or "spec-example" | "converter:<file>" | "llm"
  "status": "verified"
}
```

Field notes:
- **`expect`** carries *two* verdicts — standard MNX and the tab extension — matching the
  dual validation in the worker and the two badges in the gallery.
- **`coversDefs`** is the coverage axis. MNX v19 defines 188 `$defs`; a curated subset
  (~60–80 "feature" defs — plumbing like `positive-integer` and `*-list` wrappers excluded,
  the exclusion list lives in `manifest.json`) is the denominator. The checker reports
  "x of N feature defs exercised" and lists the uncovered ones — that list *is* the backlog,
  and "covers the spec" becomes measurable instead of aspirational.
- **`source`** matters for the CG post: "converted from real MusicXML" and "the spec's own
  example" carry more evidential weight than hand-authored JSON.

## Status lifecycle: computed where possible

`draft` → `valid` → `rendered` → `verified`, as before — but only **`verified`** is a human
assertion (visual approval). The checker *recomputes* the other rungs (does it validate as
expected? do primitives exist and match?) and fails if a claimed status is ahead of reality.
The gallery shows counts per status per category — the project's progress metric.

## Taxonomy: navigation facet, flat data model

The data model is **flat**: a scenario is its metadata; "category" is just the parent folder
acting as primary tag + sort order. The gallery browses by category by default but equally by
any facet — `coversDefs` ("everything touching `slur`"), tags, status, `idRefs`, `source`,
validity. Because grouping is a facet, a bad category assignment is a one-field fix, and the
defs coverage report — not the folder names — is what makes the "covers the spec" claim true.

| # | Category (`lab/`) | Covers |
|---|----------|--------|
| 00 | document | minimal valid doc; global + part + measure; multi-measure; empty/rest measure |
| 01 | pitches | natural notes per step; octaves; alterations (♯/♭/𝄪/𝄫); courtesy accidentals |
| 02 | durations | whole→64th; dotted; rests of each value |
| 03 | rhythm | beams (primary/secondary); beam across beat; tuplets; ties in-bar |
| 04 | time-signatures | 4/4, 3/4, 6/8, cut/common, 5/4; mid-piece change; pickup bars |
| 05 | clefs | treble/bass/alto/tenor; octave clefs; mid-measure change |
| 06 | key-signatures | C, sharp keys, flat keys; key change |
| 07 | chords-voices | chord (multi-note event); multiple sequences/voices; stem directions |
| 08 | staves-parts | grand staff; two parts; part naming |
| 09 | spanners & cross-refs | tie across barline; slurs; ottava — the id-referencing-heavy category |
| 10 | articulations | staccato/accent/tenuto/marcato; fermata |
| 11 | dynamics-directions | dynamics; tempo text; metronome marks |
| 12 | barlines-navigation | barline types (double/final/…); repeats; voltas; segno/coda jumps |
| 13 | lyrics | single verse; multiple verses; melisma (note references) |
| 14 | grace-notes | acciaccatura; appoggiatura |
| 20 | tab-part | `_x.tab` part extension: standard + alternate tunings (drop D, DADGAD), capo, `staffKind` — same music under notation/tab/both view declarations |
| 21 | tab-positions | single note with position; open strings; chords (distinct strings); annotated vs heuristic-fallback versions of the same bar |
| 22 | tab-fingering | left hand 1–4/T; right hand p-i-m-a |
| 23 | tab-techniques | bend / pre-bend / bend-release; shift & legato slides; hammer-on / pull-off chains; vibrato — all `idRefs: true` |
| 24 | tab-spec-gaps | **invalid-by-design exhibits**: TAB clef rejection; what MusicXML can say that MNX cannot; the open questions from `../../docs/tab-extension-spec.md`. This category is the w3c-cg/mnx#63 post in executable form |
| 90 | edge-cases | regressions and pathological inputs: overfull measures, pickup bars, recovered double barlines (grows as findings surface) |

Where `lab/` categories overlap the spec's own example clusters (beams, slurs, repeats,
jumps, lyrics, layouts), names align with them so `specRefs` map obviously to
`mnx-reference/objects/` pages. Where we diverge — tab, negative exhibits, edge cases —
that divergence *is* the finding: the spec's 49 examples contain nothing on tablature and
nothing invalid-by-design.

## The id-referencing axis

MNX leans on cross-references: ties target note ids, beams group events, slurs reference
start/end, voltas/jumps reference measures, melismas span notes, and the tab extension's
techniques target notes. `idRefs: true` is the cross-cutting facet that surfaces all of them —
the scenarios most likely to break a renderer get their own filter and their own emphasis in
tests. Category 09 remains the home of the gnarly multi-event spanners.

## Reference output: primitives, not SVG

The committed machine artifact is **`expected.primitives.json`** — the layout engine's output.
It is deterministic, font-independent, diffs meaningfully, and runs in Node with no DOM.
`expected.svg` is **not** committed: `renderSvg` is a pure emitter over the primitives, so a
committed SVG would state the same fact twice and churn on cosmetic renderer changes (px
scaling, class names). Visual approval (the `verified` gate) happens in the gallery's live
render or via `check-scenarios --preview` writing to a gitignored `scenarios/.preview/`.
If SVG-in-PR-diffs is missed in practice, re-add it as a CI artifact, not a committed file.

## How the library is consumed

One corpus, three consumers, no loader package yet:
- **Gallery:** `import.meta.glob('/scenarios/**/*.json')` — tree from paths, facets from metadata.
- **Tests (root vitest):** walk the filesystem; assert `validate(doc)` matches `expect` for
  every scenario (both verdicts, both directions); snapshot `layout(doc)` against
  `expected.primitives.json` where present. *Gotcha:* root vitest must ship its own
  `vitest.config.ts` — the repo's `vite.config.ts` carries the Cloudflare Workers plugin,
  which breaks under vitest (the converter sub-package hit exactly this).
- **Scripts:**
  - `scripts/check-scenarios.mjs` — the corpus police: metadata validates against
    `meta.schema.json`, JSON is canonically formatted, claimed status ≤ computed reality,
    `expect` matches actual verdicts, snapshots aren't stale, defs-coverage report.
  - `scripts/sync-spec-examples.mjs` — fetch/refresh `spec/`, regenerate its metadata,
    diff against upstream. Doubles as the schema-drift tripwire alongside re-validating
    the whole corpus after a schema bump.

## Build order

Seed `spec/` first (one script run, instant breadth — expect many to sit at `valid`/`rendered`
with honest gaps), then `lab/` **00–02 + 20–21 + 24** (basics that already render, the tab
proving ground, and the negative exhibits that anchor the CG story). Category 03 (beams,
tuplets) waits until the renderer grows those features — scenarios shouldn't be authored
around renderer strengths, but authoring effort goes where it pays first. 90 gets its first
residents immediately: overfull measures, the 1/4 pickup, double barlines.

Wire the corpus walk into vitest the same day the first scenario lands — the corpus being a
test suite from scenario #1 is the point.

## Considered and rejected

- **Defs as the organizing structure.** The 183 `$defs` are the right *coverage axis* but the
  wrong shelf arrangement: most are plumbing, the scenario↔def mapping is many-to-many, and
  the most valuable scenarios (extension, invalid, edge cases) have no def at all.
- **Embedding metadata in the document (`_x.lab` at root).** Verified schema-legal (root
  inherits `global-attrs`), but the document is the exhibit: the gallery's JSON pane and
  CG-facing examples must show pristine MNX, invalid-by-design documents need byte-exact
  control over *why* they're invalid, and status churn would dirty the music diffs.
- **`expected.svg` as a committed artifact.** See above — derived data, cosmetic churn.
- **A deep tree.** Two levels (category/scenario) is a filing convention, not a data
  structure; the model stays flat and facet-driven.
