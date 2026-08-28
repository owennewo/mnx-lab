# Measure-level attributes — the coverage census, and what is missing

> **Status: IN PROGRESS 2026-08-28 — items 1 and 2 built the same day** (the badge; the
> four bugs, with the C clef pinned by a new scenario). Goldens moved by exactly one badge
> per undrawn attribute; batch 7 in [lab-verify.md](lab-verify.md) registers them.
> **Item 3 built the same day too** — measure repeats engrave (`layout/measureRepeat.ts`),
> on notation, standalone tab and the both-view tab staves, and the badge retired.
> **Item 4 too** — hairpins draw as wedges to their end (across bars and system
> breaks, or to the bar's next dynamic when no end is named), relative dynamics as
> *cresc.* / *dim.*; badges retired. Items 5–8 open. A census, then a work list. Prompted by
> `spec/measure-repeats-with-counters` reading as a regression after the rung inspector
> ([workbench-rung-inspector.md](workbench-rung-inspector.md)) started
> naming `measure repeat: 1` on bars whose staff is empty — it was never a regression:
> **the engine has never drawn a measure repeat**, and the verified golden (2026-08-07)
> pins an empty staff. The inspector made a silent gap loud, and this doc asks how many
> more there are at the measure rung. Answer: more than expected, and — the finding that
> matters most — **none of them carries the amber badge** the renderer's own contract
> promises for a gap.
>
> Everything below is cited to a file and line as of `6858651`; the survey was a
> read-only sweep of `spec/mnx-schema.json` → `src/engine` → `src/edit` → the corpus.

## The contract this is measured against

CLAUDE.md, *Rendering*: layouts render **forgivingly** — unsupported content degrades
to a placeholder and per-measure `!` badges, red = user-fixable, blue = warning,
**amber = renderer gap**. And the verification ledger's own precedent
([lab-verify.md](lab-verify.md), on fingering): "still a renderer gap —
nothing draws `_x.mnxLab.fingering` … an amber renderer-gap badge" is what a reviewer
should expect to see. So a measure-level attribute has five things it can have, and each
is a column below:

| Column | Question |
|---|---|
| **render** | does `src/engine` read it and draw it — on notation, on standalone tab, on both? |
| **badge** | if not drawn, does the page say so? |
| **op** | can the editor write and remove it (`src/edit/ops.ts`, intents, session)? |
| **pill** | does the rung inspector read it and take it typed? |
| **corpus** | which scenarios declare it, and does the golden hold ink for it? |

Scope: every property of the pinned schema's `measure-global` (`barline, ending,
fermata, fine, jump, key, number, repeatEnd, repeatStart, segno, tempos, time` + `id`,
`_c`, `_x`) and `part-measure` (`arpeggios, beams, clefs, dynamics, measureRepeat,
nonArpeggios, ottavas, sequences`), the three proposed-schema objects the engine already
draws (`rehearsal`, `section`, `directions`), and the one `_x.mnxLab` measure block
(`harmonies`). Sequence *content* is out of scope — it is the event rung's census.

## The census

### `measure-global`

| Property | render | badge | op | pill | corpus |
|---|---|---|---|---|---|
| `barline` | ✅ all 11 types (`barlines.ts:90–207`), notation and tab. ⚠️ an explicit type on a `repeatEnd` bar is discarded — the repeat branch wins (`notation.ts:1857`) | — | ✅ | ✅ floor pill, full enum | 7 scenarios, but **only `regular`/`double`/`final` ever appear**; 8 of 11 values have no scenario |
| `repeatStart` | ✅ notation (`notation.ts:1469`), ✅ both-view dots. ❌ **standalone tab: absent** | ✗ | ✅ | ✅ | 3, inked |
| `repeatEnd` (+`times`) | ✅ notation; `Nx` only when `times ≠ 2` (`:1918`). ❌ **standalone tab draws a plain barline** | ✗ | ✅ | ✅ | 6, inked |
| `ending` (`numbers`, `duration`, `open`) | ✅ notation (`emitEndings`, `:2662`). ❌ **never on tab** | ✗ | ✅ | ✅ | 3, inked |
| `segno` | ✅ notation + tab, honours `location` **and `glyph`** (`scoreText.ts:201`; `segnoSerpent2` proven in `lab/40-navigation/01`) | — | ⚠️ `at` writes only `[0,1]`/`[1,1]`; **`glyph` unwritable** | ✅ | 5, inked |
| `fine` | ✅ notation + tab | — | ⚠️ `at` only | ✅ | 4, inked |
| `jump` | ✅ both enum values, notation + tab | — | ⚠️ `at` only | ✅ | 3, inked |
| `tempos[]` | ⚠️ **`tempos[0]` only** (`scoreText.ts:406`); **`location` ignored** — pinned to the bar prefix (`:410`); `dots` honoured | ✗ for the dropped entries | ⚠️ **writes `tempos = [value]`, replacing the array** (`ops.ts:1331`); no `dots`, no `location` | ⚠️ one pill per entry, keyed `tempo#N` — **but see bug 1** | 3; **no scenario has two tempos or a `location`** |
| `key` | ✅ notation incl. cancellation naturals; tab none by design | — | ✅ | ✅ | 5, inked |
| `time` | ✅ numerals and `common`/`cut` glyphs on notation. ❌ **`display` ignored on tab** (`tabStaff.ts:225` takes `{count, unit}`); 🐛 **multi-digit counts overprint** — every digit at one `x`, `anchor: middle` (`notation.ts:1569`, `tabStaff.ts:236`) | ✗ | ✅ | ✅ floor pill | 100+; **no `12/8`-class scenario**, so the overprint is unpinned |
| `fermata` | ❌ **not read anywhere** (nor the event-level one) | ✗ | ❌ | ❌ | 0 on the measure; `lab/32-articulations/03-fermata` (event form) is a **bare-staff golden** |
| `number` | ❌ not read; not even in `MnxGlobalMeasure` | ✗ | ❌ | ❌ | 0 — **measure numbers are never engraved** |
| colours (`ending`, `key`, `segno`, `fine`) | ❌ unread (only `rehearsal`/`section`/`direction` colour is honoured) | ✗ | ❌ | ❌ | 0 |
| `id` | reference target only (ottava `end`, mmrests, layouts); minted, never set | — | implicit | — | many |
| `_c` | unread | — | — | — | 0 |

### `part-measure`

| Property | render | badge | op | pill | corpus |
|---|---|---|---|---|---|
| `sequences` | ✅ — and **the only place a render badge fires** (`spacing.ts:1213`, unsupported content kinds) | ✅ | many | event/voice pills | all |
| `clefs` | ✅ system-start and mid-bar changes (`notation.ts:1440`, `:1524`). 🐛 **`sign: C` draws a treble clef and places pitches as treble** (`clefGlyph` has no C branch, `:343`; `pitchToStaffY` likewise). `staffPosition` ignored (`clefY` hard-codes). `octave ±2/±3` fall to a plain G | ✗ | ✅ (`setClef alto\|tenor` will happily write the broken case) | ✅ | 90+; **no scenario uses sign `C`** |
| `beams` | ✅ full forest, hooks, secondary breaks (`beams.ts`). Tab none by convention | — | ✅ `setBeam`/`removeBeam` | ❌ **no pill, no word** | 10, inked |
| `dynamics` | ⚠️ **`immediate` only**. `gradual` (hairpins) and `relative` draw **nothing** — `wedgeType`, `end`, `relativeValue`, `orient`, `voice`, `staffEnd` unread (`notation.ts:2963`; `mnx.ts:406` says "Renderer gap"). Lead part of a group only (`:1968`); priced from part 0 only (`spacing.ts:1120`). ❌ never on tab | ✗ | ✅ full union | ✅ | 5; `lab/30-dynamics/03-hairpin-and-relative` is a **bare-staff golden** |
| `ottavas` | ✅ label, dashed line, hook, split at breaks, and the pitch shift (`:2795–2834`). `voice` unread. ❌ never on tab | — | ✅ (mints the end bar's id) | ✅ | **1 scenario, `value: 1` only** — ±2, ±3, −1 have zero coverage |
| `measureRepeat` | ❌ **not read anywhere** (`elementWalk.ts:107` records it: "Renderer gap — the repeat sign is not drawn yet") — `number`, `counter`, `displayNumber`, `staffPosition` all unread | ✗ | ✅ `setMeasureRepeat {number, counter}` | ⚠️ pill shows `number` only, not the counter | 2 spec scenarios, **both bare-staff goldens** — `measure-repeats-with-counters` pins nothing but the meter |
| `arpeggios` | ❌ not read anywhere in `src` | ✗ | ❌ | ❌ | `lab/32-articulations/04-arpeggiated-chords` — **bare-staff golden** |
| `nonArpeggios` | ❌ not read; not even an `ElementKind` | ✗ | ❌ | ❌ | same scenario, same golden |

### Proposed-schema objects the engine already draws

| Property | render | op | pill | corpus |
|---|---|---|---|---|
| `rehearsal` | ✅ notation + tab, honours `color` | ✅ (no `color`) | ✅ | 5, inked |
| `section` | ✅ notation + tab, honours `color`; drives the section rung | ✅ | ✅ + go-to | 8, inked |
| `directions` | ✅ text **or** `glyphs[0]`, `orient`, `staff`, `color`; `voice` unread. ❌ **not on tab** | ⚠️ `text`+`orient` only — **`glyphs` unwritable** though rendered and corpus-covered (`lab/31-score-text/05`) | ✅ | 5, inked |

### `_x.mnxLab` at the measure

`harmonies[]` is the one measure-level vendor block (`rehearsal`/`section` left the
extension in v4). **Nothing reads it, nothing writes it, nothing shows it** — it is the
only `ElementKind` with neither `construct` nor `remove` (`elementWalk.ts:215`), and the
only scenario that mentions it is a schema-rejection exhibit with no golden.
[core-chord-symbols.md](../proposed/low-priority/core-chord-symbols.md) owns the drawing half; noted
here for completeness, not claimed.

### Does tab mirror notation?

Standalone `tab.ts` shares barlines, navigation marks (`segno`/`fine`/`jump`), tempo,
rehearsal and section with notation through the same emitters — proven by
`lab/31-score-text/10-labels-on-a-tab-staff`'s three goldens. It has **zero references**
to repeats, voltas, dynamics, directions or ottavas; the `both` view gets repeat dots and
one volta because `layoutNotation` draws them, the standalone tab view gets none. The
module header at `scoreText.ts:111–125` argues that bar-owned marks are owed to a tab
reader; repeats and voltas are bar-owned and were never moved.

## What is missing, ranked

**(e) No badge, anywhere — the finding above all the others.** `layout/diagnostics.ts`
only *draws* badges; the amber kind is produced in exactly five places, all fed by
`spacing.ts:1213` (unsupported *sequence-content* kinds) or a technique throw. **No
measure-level attribute ever produces one.** Verified on four scenarios whose `meta.json`
tags itself `renderer-gap` — `lab/32-articulations/03-fermata`,
`spec/measure-repeats-with-counters`, `lab/32-articulations/04-arpeggiated-chords`,
`lab/30-dynamics/03-hairpin-and-relative` — every one renders as a bare staff with zero
`diagnostic-*` primitives. The gap is recorded in prose (meta tags, `elementWalk.ts`'s
`classes: []` rows, the destruct sweep) and never on the page, which is exactly how a
verified empty staff came to read as a regression.

**(a) Not rendered at all**

1. `measureRepeat` — full op pair, an inspector pill, two spec scenarios, empty goldens.
2. `arpeggios` / `nonArpeggios` — a scenario, no code, no ops, no pills.
3. `fermata` (measure and event forms) — no code, no ops, no pills, no `ElementKind`.
4. `harmonies` — see above.
5. `number` — measure numbers are never engraved.
6. The colour properties on `ending`/`key`/`segno`/`fine`/`clef`; `clef.glyph`,
   `clef.showOctave`, `clef.staffPosition`; `_c`.

**(b) Rendered partially**

1. **Hairpins and relative dynamics draw nothing** — the biggest musical hole.
2. **The C clef is drawn as a treble clef and mis-places every pitch** — and the grammar
   will write one.
3. `tempos`: index 0 only, `location` ignored.
4. `repeatEnd` discards an explicit `barline.type`.
5. `time.display` ignored on tab; multi-digit time signatures overprint on both staves.
6. `clef.octave` ±2/±3 fall back to a plain G clef.
7. Standalone tab lacks repeats, voltas, dynamics, directions, ottavas.
8. Dynamics/directions read from a group's lead part only, priced from part 0 only.

**(c) Rendered but unwritable**

`segno.glyph`; arbitrary `location` fractions on `segno`/`fine`/`jump`;
`direction.glyphs`; `tempo.value.dots`; a second `tempos` entry.

**(d) Writable but no pill**

`beams`; `measureRepeat.counter` (written, not shown).

## Bugs, as opposed to gaps

Found by the sweep and confirmed by hand; each is a one-file fix and a test:

1. **`removeMeasureAttribute` drops the tempo index.** The op takes `index`
   (`ops.ts:747`), the inspector's `tempo#N` pill emits it, but the *intent* has no
   `index` (`intents.ts:157`) and `session.ts:1267` never forwards one — so removing
   the second tempo's pill deletes the first. Introduced today by the inspector's
   per-entry pills; the popover never exposed a second entry so never hit it. Fix: an
   optional `index` on the intent, threaded through.
2. **`removePositioned` is staff-blind.** The session matches on onset only
   (`session.ts:1082`), while `readPositionedAttributes` filters by staff — on a grand
   staff the wrong dynamic goes.
3. **`setMeasureAttribute {kind: 'tempo'}` replaces the array**, so a second tempo is
   unauthorable and the `#N` keys can never exceed `#0` through the editor.
4. **`clefGlyph` has no `C` branch** — see (b) 2.

## The work, in order

1. ✅ **The badge** (2026-08-28) — `measureLevelGaps` in `spacing.ts`, one render issue per
   undrawn attribute per bar, consumed by notation and tab alike; `measure-gaps.test.ts`
   holds the list. Ledger batch 7.
2. ✅ **The four bugs** (2026-08-28) — `index` on the set/remove intents and the set op
   (absent = the popover's replace-first; the length appends), threaded from the
   inspector's `tempo#N` key; `removePositioned` matches the cursor's staff; `clefGlyph`
   gains `cClef` and every clef now honours `staffPosition` (`clefLineY`), pinned by
   `lab/pitches/alto-and-tenor-clefs`.

3. ✅ **Measure repeats** (2026-08-28) — one emitter, `emitMeasureRepeat`: the ％ sign
   (`repeat1Bar`/`repeat2Bars`/`repeat4Bars` by `number`) on the middle line; the one-bar
   form centred in the bar, the two-bar form on the barline it covers, longer spans
   centred over the span; the span number above when > 1 (`displayNumber: false` turns
   it off); the counter above or below per `orient`. Labels once per bar (the notation
   staff carries them in the both view), the sign on every staff of the part. The
   inspector pill grows the counter (`measure repeat: 1 counter 3`). Both spec goldens
   moved again — batch 7 says what to look for.

4. ✅ **Hairpins and relative dynamics** (2026-08-28) — `emitHairpins` is a post-pass on
   the ottava's pattern (spans collected before the measure loop, ends resolved on note
   columns from the shared onset capture, split at system breaks with the opening
   growing linearly along the whole span); an `end` may name a later bar; with no `end`
   the wedge runs to the bar's next dynamic on that staff, else to the bar's content
   end. `dynamicLabel` gives a relative group without a value its word, set small and
   italic like a direction. Notation only — tab parity is item 6.

Original plan:

1. **The badge.** A measure-level pass beside `spacing.ts:1213`: for each attribute the
   engine does not draw (`measureRepeat`, `arpeggios`, `nonArpeggios`, `fermata`,
   `harmonies`, a `gradual`/`relative` dynamic, a `C` clef until fixed, a second tempo),
   push an amber `render` issue on that bar. Moves the goldens of every scenario in the
   "bare staff" list by exactly one badge primitive each — register the batch in
   [lab-verify.md](lab-verify.md). After this, a reviewer can see a gap
   without reading `meta.json`.
2. **The four bugs.** Each with a test that would have caught it; the tempo-index one
   also gets a corpus scenario with two tempos in one bar, which is the case the sweep
   found untested.
3. **Measure repeats.** The ％ sign (`repeat1Bar`, `repeat2Bars`, `repeat4Bars` by
   `number`) centred in the bar, the counter above per `counter.orient`, on notation and
   tab; the inspector pill grows the counter. Moves `spec/measure-repeats{,-with-counters}`.
4. **Hairpins and relative dynamics.** `wedgeType` + `end` as a spanner (the same
   split-at-system-break the ottava does), `relativeValue` as text. Moves
   `lab/30-dynamics/03`.
5. **The C clef**, with an alto and a tenor scenario to pin it.
6. **Tab parity for bar-owned marks**: repeats, voltas, then dynamics/directions/ottavas
   on the tab staff — finishing what `scoreText.ts`'s header started.
7. **Writers for what already renders**: `segno.glyph`, `direction.glyphs`,
   `tempo.dots`, arbitrary `location`, a second tempo (an `index` on the set op), and
   the `beams` pill.
8. **The rest of (a)** — fermata, arpeggios, measure numbers — each as its own small
   engraving item; `harmonies` stays with core-chord-symbols.

Items 3–6 move goldens and go through the ledger; 1 and 2 are the ones to do first,
because they change what a reviewer *sees* and stop the next inspector pill from being
mistaken for a regression.

## Related

- [workbench-rung-inspector.md](workbench-rung-inspector.md) — what made
  the gaps visible; bugs 1 and 2 are its.
- [core-element-ops-rhythm-declarations.md](../complete/core-element-ops-rhythm-declarations.md)
  — the ops half of measure repeats and full-measure rests, which explicitly left the ink
  where it was.
- [core-element-ops-bar-attributes.md](../complete/core-element-ops-bar-attributes.md) —
  the op family for the global measure.
- [lab-verify.md](lab-verify.md) — the fingering precedent for the badge,
  and where the golden batches from items 1 and 3–6 register.
- [core-chord-symbols.md](../proposed/low-priority/core-chord-symbols.md) — owns `harmonies`.
