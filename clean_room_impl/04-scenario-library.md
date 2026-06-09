# 04 — The Scenario Library

> **Stability: provisional — but this is the heart of the plan.** The library is a
> hierarchical corpus of small, valid MNX documents that together cover the spec. It is
> simultaneously the renderer's test fixtures, the content of the gallery app, and
> executable documentation of MNX. Get this structure right and most other things fall out.

## What a scenario is

A scenario is **one small, valid MNX document (usually 1–2 bars)** that isolates **one
feature** of the spec, with metadata describing what it demonstrates and (eventually) a
rendered reference output.

Design rules for scenarios:
- **Minimal.** Show one thing. A beam scenario has two notes, not a melody.
- **Valid.** Every `score.mnx.json` must pass `mnx-core` validation. No exceptions — the
  library *is* the validation corpus.
- **Readable.** A human should understand the JSON at a glance. Comments live in `notes.md`,
  not the JSON.
- **Stable.** Once verified, the reference output is committed and changes are reviewed.

## Folder layout (one folder per scenario)

The folders *are* the source of truth; the catalog is generated from them.

```
packages/mnx-scenarios/
  scenarios/
    00-document/
      00-01-minimal-single-note/
        scenario.json        # metadata (see schema below)
        score.mnx.json       # the MNX document — small & valid
        expected.svg         # rendered reference; committed once verified
        notes.md             # optional: what's interesting / spec prose
      00-02-global-and-one-part/
        ...
    01-pitches/
      01-01-natural-notes/
      01-02-accidentals/
    03-rhythm/
      03-01-two-eighths-beamed/
      ...
  src/
    index.ts                 # loader API (contract C6)
    catalog.generated.ts     # built by a script that walks scenarios/
  scripts/build-catalog.ts
```

IDs encode the hierarchy: `category-NN-slug` → `03-02-...`. Numbered prefixes give stable
ordering and room to insert (gaps are fine); the slug keeps it human.

## `scenario.json` schema

```jsonc
{
  "id": "03-02-two-eighths-beamed",
  "title": "Two beamed eighth notes",
  "category": "03-rhythm",
  "description": "A single beam joining two eighth notes within one beat.",
  "bars": 1,
  "tags": ["beams", "duration:eighth"],   // faceted browsing / cross-cutting axes
  "specRefs": ["mnx:beams"],               // pointer(s) into the MNX spec section
  "requires": ["beaming"],                 // renderer capabilities exercised
  "idRefs": true,                          // does it exercise cross-referencing? (see below)
  "status": "draft"                        // lifecycle, see below
}
```

### Status lifecycle (drives the coverage dashboard)
`draft` → JSON written ·
`valid` → passes `mnx-core` validation ·
`rendered` → renderer produces output ·
`verified` → output visually approved + `expected.svg` committed.

The gallery shows counts per status per category — that's the project's progress metric and
the embodiment of "do a small bit well": we can be at `verified` on category 00–03 while 20+
are still `draft`.

## Taxonomy (provisional — your domain call)

Grounded in MNX's actual structure (`global` / `parts` / `sequences` / events), with gaps in
the numbering for insertion. **This is the section most likely to change — edit freely.**

| # | Category | Covers |
|---|----------|--------|
| 00 | document | minimal valid doc; global + part + measure; metadata; multi-measure; empty/rest measure |
| 01 | pitches | natural notes per step; octaves; alterations (♯/♭/𝄪/𝄫); courtesy accidentals |
| 02 | durations | whole→64th; dotted; rests of each value |
| 03 | rhythm | beams (primary/secondary); beam across beat; tuplets (triplet, nested); ties in-bar |
| 04 | time-signatures | 4/4, 3/4, 6/8, cut/common, 5/4, compound, mid-piece change |
| 05 | clefs | treble/bass/alto/tenor/percussion; octave clefs; mid-measure change |
| 06 | key-signatures | C, sharp keys, flat keys; key change |
| 07 | chords-voices | chord (multi-note event); multiple sequences/voices; stem directions |
| 08 | staves-parts | grand staff (one part, two staves); two parts; part naming |
| 09 | **spanners & cross-refs** | tie across barline; slurs (simple/overlapping); ottava; pedal — **the id-referencing-heavy category** |
| 10 | articulations | staccato/accent/tenuto/marcato; fermata; trill/mordent/turn |
| 11 | dynamics-directions | dynamics; hairpins; tempo text; metronome marks; rehearsal marks |
| 12 | barlines-navigation | final/double barline; start/end repeat; voltas (1st/2nd endings); segno/coda + D.C./D.S. jumps |
| 13 | lyrics | single verse; multiple verses; melisma (note references) |
| 14 | grace-notes | acciaccatura; appoggiatura; grace before/after |
| 20 | guitar-tab | string tuning def; tab staff with fret numbers |
| 21 | guitar-fret-string | chords on tab; explicit `_x.guitar` string/fret assignment |
| 22 | guitar-fingering | left-hand fingering; right-hand (p i m a) |
| 23 | guitar-techniques | hammer-on/pull-off; slide; bend (with target); vibrato; palm mute |
| 24 | guitar-_x | capo; tuning override; the `_x.guitar` shape itself |
| 90 | edge-cases | regressions; pathological inputs (grows as bugs surface) |

## The id-referencing axis (you flagged this specifically)

MNX leans on cross-references: ties target note ids, beams group event ids, slurs reference
start/end events, voltas/jumps reference measures, lyrics melismas span notes. Two handles:

- **Category 09** is the home for the gnarly multi-event *spanners* (slurs, ottava, pedal).
- **`idRefs: true`** is a cross-cutting tag, so a faceted view surfaces *every* scenario that
  exercises referencing — across ties (03), voltas/jumps (12), melismas (13), and guitar
  techniques (23). These are the scenarios most likely to break a renderer, so they get their
  own filter in the gallery and their own emphasis in tests.

## How the library is consumed (contract C6, see `02-architecture.md`)

```
listScenarios(): ScenarioMeta[]
loadScenario(id): { meta, doc: MnxDocument, expectedSvg?: string }
```
- `mnx-core` tests: iterate `listScenarios()`, assert `validate(doc).valid` for every one.
- `mnx-render` tests: iterate, compare `render(doc)` to `expectedSvg` (snapshot).
- `gallery` app: render the tree from `listScenarios()`, show JSON + live render + reference.

One corpus, three consumers — that's why it's a package, not a loose folder.

## Build order for the corpus itself
Seed 00–03 first (they prove the whole pipeline end to end on the simplest features), then
broaden. Guitar (20–24) and cross-refs (09) come once the basics render cleanly — they're
where the renderer earns its keep.
