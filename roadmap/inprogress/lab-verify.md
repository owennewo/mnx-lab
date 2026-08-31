# lab-verify — the standing verification ledger

> **Status: STANDING — opened 2026-08-22. This doc does not move to `complete/`.**
> It is a living contract plus a debt register, not a work item. It closes only if the
> corpus stops being verified by hand.

Every other roadmap doc describes something that gets built and then stops. This one
describes an obligation that never stops, because `verified` is a **human assertion** and
code lands faster than a human can look at it.

## Why it exists

Verification is the one gate an agent cannot pass on its own. `npm run update:primitives`
demotes `verified` → `rendered` the moment a golden moves, which is correct — but it means
any change to `model/`, `engine/` or `scenarios/` leaves a pile of scenarios waiting on
someone's eyes, and the work item that caused the pile cannot honestly call itself done
while the pile stands.

The result was a coupling nobody chose:
[core-ink-measured-gaps.md](../complete/core-ink-measured-gaps.md) had all four of its
stages built and still said stage D was "taken only once A–C are verified, on their
evidence" — the engineering finished, the doc pinned open by 33 scenarios nobody had
reviewed. [core-ragged-last.md](../complete/core-ragged-last.md) was blunter still:
*"BUILT, awaiting the `/verify` sweep"* was its entire remainder. Worse, two
spec-conformance fixes (`fab5a85`, `ff5ae78`) moved goldens without an owning roadmap
doc at all, so their debt was recorded nowhere but the queue.

Both items closed on 2026-08-22 the day this ledger opened, owing nothing but the
approvals below — which is the ledger working as intended, on its first day.

This doc decouples the two. **An item may reach `complete/` owing verification, provided
the debt is registered here with its cause.** The build work and the looking are separate
kinds of work with separate rhythms; the only thing they must share is a ledger.

## What this is not

**It is not the queue.** The queue is derived from committed provenance and is always
current:

```bash
npm run verify:scenarios -- --list          # blocked → stale → never-seen; current counted
npm run verify:scenarios -- --list --json   # the same, machine-readable
```

Never hand-copy per-scenario status into this file. A checked-in table of 107 scenarios is
wrong the next time anyone runs `update:primitives`, and a stale ledger is worse than no
ledger. What the queue **cannot** record — and what belongs here — is *why* a batch went
stale, *who* owes it, and *what a reviewer should be looking at* when they open the page.

Provenance answers "did this change?". This doc answers "should it have?".

## The handoff contract

1. **A work item may close with verification outstanding.** Landing the code and earning
   the approvals are separate obligations. Do not hold a doc in `inprogress/` for want of a
   human's eyes.
2. **Closing with debt requires registering a batch here** — in *Open debt* below, before
   the doc moves to `complete/`. The register entry states: the cause (roadmap doc and/or
   commit), the scenario set, which goldens moved, and **what a reviewer should look for**.
   That last field is the whole point: the person approving six months from now did not
   write the change, and "the primitives hash moved" tells them nothing.
3. **The closing doc names the batch; the batch names the closing doc.** Two-way link, so
   neither half can be found without the other.
4. **Debt with no owning roadmap doc is registered here directly.** A standalone
   conformance fix that moves goldens still owes the corpus a look — `fab5a85` is the
   worked example, and it is in the register below precisely because it had nowhere else
   to go.
5. **Registration is not pre-approval.** Writing an entry records that a change is
   *expected* to have moved the output. It does not assert the new output is right. Only
   `harness/verify/verify-scenarios.mjs`, driven by the **`/verify`** skill with a human in
   the loop, may write `status: verified` or a `verification` record. Never hand-edit
   either — that forges a human assertion, and the rule holds identically when resolving a
   rebase conflict.
6. **A batch is retired only when its scenarios leave the queue.** Move the entry to
   *Settled* with the sweep's date and anything the review taught. If the review **rejects**
   the output, the batch stays open and the finding goes to its own roadmap item — never
   approve to clear a row.
7. **Sweeps are batch-shaped, not scenario-shaped.** Review a whole cause at once: the
   scenarios in a batch moved for one reason, so a reviewer who has understood the reason
   once can spend the rest of the sweep checking whether each scenario obeys it.

## Open debt

*Counts below are the queue as of 2026-08-24 (0 blocked, **46** stale, 12 never-seen, **53**
current — batch 6 demoted 9).
Batches are grouped by cause; the commit named for each sub-set is the one that **last
moved** those goldens, which is not always the one that demoted them.*

### 12. Lyric width split around the note — **4 stale**

Owner: no roadmap doc — a user-reported occlusion (2026-08-31): a wide
syllable's width was priced entirely to the RIGHT of its note's anchor while
the text draws centred, so "extraordinarily" reached back over the word
before it. `spacing.ts` now splits the lyric requirement around the anchor —
half into the column's leading, half into its core. The total rigid width is
unchanged by construction, so bar widths and wrapping cannot move; only
lyric-bearing anchors shift right by half the syllable's overhang.
Scenarios: `spec/lyrics-basic`, `spec/lyrics-multi-line`,
`spec/lyric-line-metadata`, `lab/lyrics/verse-labels` (all four demoted
verified → rendered; `lab/lyrics/tab-verses` moved too but was never seen —
it stays in batch 10). Pinned by `harness/conformance/lyric-spacing.test.ts`,
which reproduces the occlusion against the old pricing.

**What a reviewer should look for.** Syllables still CENTRED under their
notes (the fix moved the note, not the text's anchor); adjacent words with
clear air between them, wide ones included; hyphens still midway between
their syllables; and bar widths visually identical to the previous
approvals — only the horizontal position of lyric-bearing notes inside
their columns moved, by half a syllable's overhang at most.

### 11. Barline weights unified across staff kinds — **27 tab goldens moved, all already `rendered`**

Owner: no roadmap doc — the audit-cleanup sweep (2026-08-31). The standalone tab
layout carried its own lighter barline strokes (thin 0.1sp / thick 0.4sp) while the
notation layout — which also draws the native tab staff in the `both` view — used
0.16/0.5, so the same tab staff rendered with different line weights depending on
view. Both layouts now consume ONE `STANDARD_BARLINE_METRICS` (0.16/0.5/0.3) from
`src/engine/layout/barlines.ts`. 27 scenarios moved, `expected.primitives.json` +
`expected.tab.svg` only — **no notation or both golden moved**, which is itself the
check that the fix touched exactly the forked half (the 27th,
`lab/50-lyrics/02-tab-verses`, landed upstream mid-audit and joined on rebase). Every affected scenario was
already `rendered` (owed to earlier batches), so no `verified` approval was
invalidated; this note records the additional cause a reviewer will see.

**What a reviewer should look for.** In the standalone TAB view only: barlines,
final barlines and repeat strokes are slightly HEAVIER than before and now match
the `both` view's tab staff exactly — flip between `?view=tab` and `?view=both` on
any tab scenario and the stroke weights should agree. Everything else (columns,
digits, spacing) is unchanged; any horizontal movement beyond the final barline's
thick stroke growing inward is a failure.

### 10. Lyrics reach the standalone tab view — **1 never-seen**

Owner: no roadmap doc — a user-directed renderer follow-up to
[workbench-one-surface-lyrics.md](../complete/workbench-one-surface-lyrics.md)
(2026-08-31): the standalone tab layout now draws verse rows below the
strings (the shared emitter extracted to `engine/layout/lyricRuns.ts`; the
plan already priced syllable widths, so no digit column moved and **no
existing golden moved** — the lyrics×tab corpus intersection was empty).
Scenario: `lab/lyrics/tab-verses` (new; never approved — its goldens moved
freely while the geometry settled).

**What a reviewer should look for.** Three views, one document (four bars of
quarters, two verses with split words, wrapping into TWO systems at the
harness viewport — resized 2026-08-31 after a one-bar first cut let an
inter-system overlap ship: each tab row now reserves the verse block
explicitly, notation's own `lyricExtraSp` rule, and `tightenRows` is told
the reservation so it attributes a deep verse row to the system it hangs
from, not the one below). (1) TAB view: verse rows below EACH system's
strings, syllables centred under their fret digits, hyphens between split
pairs, and the second system starting clear of the first system's verses.
(2) NOTATION view: the same rows as the existing lyric scenarios draw them.
(3) BOTH view: the verses appear ONCE per system, between the notation
staff and the tab staff, never duplicated below the strings.
Known deliberate roughness: verse 1's baseline (+4.5sp) sits close to where
dynamics would draw (+3.5sp) — this document has none; the collision is
pre-existing and unarbitrated in every view.

### 9. Hammer-on/pull-off merged into one letterless adornment — **1 stale**

Owner: no roadmap doc — a user-directed schema change (extension v5 → v6,
2026-08-30, the Soundslice convention): `technique.hammerOn`/`pullOff` merged
into ONE `hammerPull`, drawn as a slur with NO `H`/`P` letter — the direction
is implicit in the two pitches. Scenario: `lab/tab-techniques/03-hammer-pull-chain`
(all four goldens moved).

**What a reviewer should look for.** Two changes, one cause. (1) The `H` and
`P` letters above the arcs are GONE, on every staff (tab, notation, both) —
absent letters are the point. (2) On the TAB staff the arcs moved DOWN: each
now springs from just above its two digits and hugs the string the finger is
on (~0.85sp above the line), instead of being parked in the technique lane at
the top of the staff. On the notation staff the arcs still hug the noteheads.
An arc missing entirely, or one running along a string line, is a failure.

### 8. `core-bend-stops` — stop-grammar bends, vertical arrivals, arrival labels — **2 never-seen**

Owner: [core-bend-stops.md](../complete/core-bend-stops.md) (2026-08-30; **closed the
same day owing these approvals**). Scenarios: `lab/tab-techniques/bend-and-release`
(golden moved — it leaves batch 4 for this one, the same way the technique five left
batch 3) and `lab/tab-techniques/06-bend-shapes` (new). Both never-seen.

**What a reviewer should look for.** One cause, two visible effects. (1) **Geometry**:
every bend curve now arrives VERTICALLY — the rise ends straight up under its label,
the release lands straight down on the string line — so each arrowhead sits on the
curve's own tangent instead of being glued vertically onto a flat arrival (the old
`bendSegment` put its last control point at the arrival height). (2) **Labels**: every
arrival OFF the written pitch is labelled, rising or falling, so `0>full>1/2` reads
`full` then `1/2` — before, a partial release was indistinguishable from a full one; a
landing at 0 still carries no label. In `06-bend-shapes` also check: the double bend's
two peaks both labelled; the hold's flat segment carries NO arrowhead; the weighted
release (`0>full>>>0`) rises over the first quarter of the note and falls over the
rest. Agreement 5's two-batch split (geometry, then labels) was not kept — both landed
in one pass — so this one batch carries both questions. *Follow-up, same day: each
arriving curve now ENDS at its arrowhead's base-centre instead of running to the tip
underneath the glyph (the way an SVG marker shortens a path, and the way the
pre-bend's vertical line always did) — the joint is the glyph's own anchor, so it
cannot drift when the vertical zoom makes the scale non-square. Departures still
leave from the stop itself. Check: no gap and no overlap where a curve meets a head,
at any staff scale.*

### 7. `core-measure-attributes-gaps` — the amber badge for undrawn measure attributes — **4 stale, 8 never-seen**

Owner: [core-measure-attributes-gaps.md](core-measure-attributes-gaps.md) (in progress,
items 1–9, and core-chord-symbols.md's rendering half). Demoted 2026-08-28; grown 2026-08-29 (items 7–9, chords).

**Cause.** No measure-level attribute ever produced the amber renderer-gap badge: the
badge machinery was fed only by unsupported sequence-content kinds, so a bar whose
`measureRepeat`, `arpeggios`, `nonArpeggios`, `fermata`, hairpin/relative `dynamics`,
second `tempos` entry or `harmonies` were not drawn rendered as a bare staff — and a
verified bare staff read as a regression the moment the rung inspector named the
attribute on it. `measureLevelGaps` (`src/engine/layout/spacing.ts`) now pushes one
render issue per undrawn attribute per bar. **Nothing else about these renders moved**:
the diff on each golden is the badge primitives (rect, title, glyph) and nothing more.

**Scenarios (3 stale).** `spec/measure-repeats`, `spec/measure-repeats-with-counters`,
`lab/dynamics/hairpin-and-relative`, `lab/articulations/arpeggiated-chords` (the first
was `rendered` already, so three demote).

**Moved again the same day (items 3 and 4).** The two `spec/measure-repeats*` goldens
moved a second time: the ％ sign is now drawn (`src/engine/layout/measureRepeat.ts`) and
its badge retired. `lab/dynamics/hairpin-and-relative` likewise: the crescendo wedge and
the word `cresc.` are drawn (`emitHairpins`, `dynamicLabel`) and its badges retired.
What to look for on those three changed — see below.

**Never-seen (3).** `lab/navigation/repeats-and-marks-on-tab` — new (item 5): a
tab-opting part whose STANDALONE tab staff must now show what the notation staff shows —
`|:` with dots straddling the middle of the six lines and the cut-time symbol on bar 1,
a first-ending bracket over bar 2 closed by `:|` with `3x` over the barline, an open
second-ending bracket over bar 3, a final barline on bar 4, `mf` under bar 1 and `f`
under bar 4, and *Swing* over bar 1. The notation and both views are the cross-check:
the same marks at the same columns. `lab/dynamics/diminuendo-across-bars` — new: a decreasing wedge
whose `end` names the next bar, closing on that bar's `p`; the wedge should be open
(1.5 sp) at bar 1's third beat and come to a point just before bar 2's third beat,
crossing the barline as one pair of lines. `lab/pitches/alto-and-tenor-clefs` — new, authored to pin the C clef
(bug 4 of the same doc: a C clef drew as a treble clef and placed every pitch a sixth
wrong; no scenario had a C clef). Alto in bar 1, tenor in bar 2, the same four pitches.

**Fermatas (item 7, 2026-08-29).** `lab/articulations/fermata` is **stale**: the whole
note now carries the plain sign 1.5 sp above the staff, centred on the note, and its
badge-less staff is otherwise unchanged. `lab/articulations/fermatas-on-bars-and-rests`
is **never-seen**: bar 1 — a stem-down C5 with an accent AND a fermata (the accent
nearest the head, the fermata outside it), an angled fermata over the quarter rest, a
square fermata over the stem-up half note CLEAR OF THE STEM TIP, and the plain sign over
the barline between the bars; bar 2 — a fermata UNDER the half note (`orient: below`,
the inverted sign), the curlew under the half rest (`pointing: down` reads as
the below form), and a square sign under the final barline. Nothing on any tab view but
the two bar-form signs.

**Arpeggios and numbers (item 8, 2026-08-29).** `lab/articulations/arpeggiated-chords`
moved again: the badges are gone and the marks are drawn — a wavy line up the left of
the first chord from just below its bottom note to just above its top, an arrowhead at
the top (the roll is `up` with `arrow`), and a square bracket `[` to the left of the
second chord, its hooks pointing at the notes. Neither may touch a notehead. The
paragraph below about two amber badges on this scenario is superseded.
`lab/navigation/numbered-bars` is **never-seen**: `17`, `18`, `19` in small upright
figures just above the top line at the start of bars 1–3, nothing on bar 4; the segno
over bar 2 and the metronome mark over bar 3 sit higher, clear of their numbers.

**Colours, clef forms, every tempo (item 9, 2026-08-29).** Two **never-seen**.
`lab/navigation/tempo-change-mid-bar`: ♩ = 120 over bar 1's start, ♩ = 60 over its
third beat, 𝅗𝅥 = 90 over bar 2's second beat — three marks, none overlapping, each
just clear of the ink under it. `lab/layout/coloured-marks-and-clef-forms`: a grand
staff; green sharps in both key signatures, a blue first-ending bracket and `1.`, a
red segno and a red *fine*, a purple treble clef with NO `8` under it (the D4/E4 are
written a step above the middle line, an octave up — the clef sounds 8vb), a bass
clef WITH an `8`; bar 2 a treble clef with `15` over it and a plain bass clef (the
`fClefChange` glyph, drawn as declared) — verify no clef in bar 2 carries an `8`.

**Chord symbols (core-chord-symbols.md, 2026-08-29).** `lab/score-text/chord-symbols`
is **never-seen**: bold `D`, `A7/C♯`, `Bm7b5`, `N.C.`, `E♭Δ7` just above the staff, each
starting a touch left of its note's column, the sharp and flat as real signs on the root
and bass only; ♩ = 100 on bar 1 sits ABOVE the `D`. Nothing on the tab views but the same
symbols in the same columns.

**What a reviewer should look for.** On `arpeggiated-chords`: the music is unchanged and
the bar carries two amber badges at its bottom-left (arpeggio, non-arpeggio). If any
*ink* moved, reject. On `hairpin-and-relative` (engraving taste — no spec reference): a
crescendo wedge under the staff opening from the first note's column to just before the
third beat, where the word *cresc.* starts in small italics on the dynamic row; no
badge. On the two `measure-repeats*`: both are spec-mirrored, so the CG's reference
engraving in the compare pane is the verdict. `measure-repeats`: a one-bar ％ on the
middle line, centred, in bars 2 and 4; the two-bar sign ON the barline between bars 7 and
8 with `2` above it; no badge anywhere. `measure-repeats-with-counters`: three one-bar
signs with `2`, `3`, `4` above them. The sign is Bravura's `repeat1Bar`/`repeat2Bars`,
so its size and slash angle are the font's, not ours. On the clef
scenario: the alto clef sits on the middle line with middle C on it; the tenor clef on
the fourth line with middle C there; the E–G–A pattern shifts one line between bars.

### 6. `core-rung-insert` — rests carry their event's id — **9 stale**

Owner: [core-rung-insert.md](core-rung-insert.md) (in progress). Demoted 2026-08-24.

**Cause.** A rest emitted no `sourceId`, so nothing in the rendered SVG said WHICH rest a
selection meant. The enclosure fell back to interpolating the metric fraction across the
bar and drew its box on the wrong beat — visible the moment insert-then-delete left a rest
mid-bar. Rests now carry their event's id (real `event.id`, else the new
`syntheticEventKey`), and light with a `selected` class like any other ink.

**Scenarios (9).** `lab/rhythm/appoggiatura`, `lab/rhythm/tuplet-number-hidden`,
`lab/articulations/unrendered-marks`, `spec/beams`, `spec/beams-across-barlines`,
`spec/beams-inner-grace-notes`, `spec/beams-secondary-beam-breaks`,
`spec/beams-secondary-beam-breaks-implied`, `spec/rest-positions`.

**What a reviewer should look for: nothing should have moved.** This is a pure metadata
addition — a `sourceId` key on rest glyph primitives and a `data-source-id` attribute in
the SVG. **No geometry, no glyph, no colour changes**, so the render must be
pixel-identical to the approved one; the diff is entirely `"className": "rest"` gaining a
sibling key. If anything about a rest's POSITION or SHAPE differs, that is a real
regression and not this batch.

`spec/rest-positions` is the one to read first — it is the scenario that exists to pin
where rests sit, so it is where a positional regression would show most plainly. The three
`beams-*` scenarios are next: their rests break beam groups, and a rest that moved would
drag beam geometry with it.

### 1. `core-ink-measured-gaps` — vertical distance measured ink to ink — **33 stale**

Owner: [core-ink-measured-gaps.md](../complete/core-ink-measured-gaps.md) (stages A–D all
built 2026-08-21; **closed 2026-08-22 owing these approvals**). This is the doc the
ledger exists to unpin, and it is unpinned.

**Second owner, same batch:** [core-ragged-last.md](../complete/core-ragged-last.md)
(`7ebcdab`, also closed 2026-08-22) demoted `lab/document/navigation-playground`,
`lab/durations/rest-gallery` and `spec/tie-targets`. Stage D (`018073d`) then moved
those same three goldens again, so the table below files them under stage D by the
last-moved rule. **A reviewer approving those three settles both items at once** — and
must read both rationales: the last system should sit at its page's texture *and* the
gap above it should be ink-measured.

| Sub-set | Last moved by | Scenarios |
|---|---|---|
| Stage A — score text placed one clearance above the ink under it | `da6534c` | 5 — `spec/tempo-markings`, `lab/score-text/{rehearsal-marks, sections, sections-with-rehearsal-marks, labels-with-navigation}` |
| Stage C — every display gap ink-measured via the probe pass | `ddbf5d7` | 6 — `spec/{grand-staff, organ-layout, parts}`, `lab/score-text/{directions-across-parts, directions-multi-staff}`, `lab/layout/group-barline-individual` |
| Stage D — inter-system gaps ink-measured too | `018073d` | 9 — `spec/{multimeasure-rests, multiple-layouts, orchestral-layout, system-layouts, tie-targets}`, `lab/document/{navigation-playground, twelve-bar-blues}`, `lab/durations/rest-gallery`, `lab/dynamics/all-dynamic-marks` |
| Tab row pads 4/4 → 2/2 → 3/3 | `3393bd3` → `f42230d` | 13 — `lab/document/empty-tab-canvas`, `lab/tab-part/standard-tuning-both`, `lab/tab-positions/open-strings-chord`, all 10 of `lab/tab-derivation/*` |

**What a reviewer should look for.** The claim under test is that *nothing collides and
nothing floats* — the same two clearance constants everywhere: cohesion (a label to its own
staff, ≈1sp) and separation (staff to staff, system to system, ≈3sp). Concretely:

- **Stage A**: a section or rehearsal label sits one clearance above the tallest ink
  actually beneath its footprint — not above a geometric staff line. It must not crowd a
  treble stem, and must not float over a stemless tab staff.
- **Stage C/D**: gaps between staves and between systems track the ink, so a sparse system
  closes up and a busy one opens out. Uneven row pitch down a page is the *expected*
  outcome here, not a bug — check that each gap is justified by what is in it.
- **Tab pads**: 6sp between bare tab systems. The tuning was settled by eye (4/4 read as
  abandoned, 2/2 as crowded), so this sub-set is the one most worth disagreeing with.
  `tightenRows` still widens any row whose ink overruns the pad — a collision here is a
  bug, not a taste question.

Both goldens (`expected.both.svg`) moved for the tab sub-set. Approving stamps a hash per
golden, so **every projection a scenario pins must actually be looked at** — notation, tab
and both.

### 2. Barline defaults — **4 stale**, no owning roadmap doc

Cause: `fab5a85` (2026-08-15), "The barline stops being a fact about position and becomes
one the document states". The old code drew thin-unless-last and never read
`measure-global.barline`, inverting the spec's "if not provided" clause — the default was
applied even when the document had spoken.

Scenarios: `spec/{hello-world, three-note-chord-and-half-rest, two-bar-c-major-scale,
measure-repeats}`.

**What a reviewer should look for.** All four are spec-mirrored, so the CG's reference
engraving in the compare pane is the verdict, not a matter of taste. The first three
declare `regular` and should draw a plain barline where we previously drew thin+thick;
`measure-repeats` declares `double` at bar 4 and should draw a double barline where we
previously drew a plain thin line. If our render and the reference disagree, the render is
wrong.

### 3. Never reviewed since authoring — **9 never-seen**

| Cause | Scenarios |
|---|---|
| `75e566b` (2026-08-10) — corpus closure, nine new lab categories | 2 — `lab/tab-fingering/{left-hand-fingers, right-hand-pima}` |
| `ff5ae78` (2026-08-15) — score-wide marks stop belonging to the notation staff | 1 — `lab/score-text/labels-on-a-tab-staff` |
| [workbench-rung-legibility.md](../complete/workbench-rung-legibility.md) (2026-08-22) — a scenario authored to exercise the bar-vs-section degeneracy | 1 — `lab/score-text/one-bar-sections` |

`one-bar-sections` is the odd one out and the easiest: it moved no existing golden (the
rung-legibility item is chrome, and `update:primitives` came back clean on every other
scenario), so it is here only because a new scenario has never been read. Four bars, each
its own section, four labels in a row — the question is whether the label row is engraved
correctly when every bar carries one, which is also the ink-measured-gaps stage A claim
under its densest case. The *selection* behaviour it was authored for is overlay chrome
and is not in any golden; it is pinned by `section-label-chip.test.ts` instead.

*The five `lab/tab-techniques` scenarios left this batch on 2026-08-24: their goldens moved
when technique started being drawn, so they belong to batch 4 and its cause rather than to
corpus closure.*

**What a reviewer should look for.** These have no approved hash at all, so there is no
diff to reason from — this is a first reading, and the question is the ordinary one: does
the engraving say what the scenario's `description` claims it says? The fingering pair is
still a renderer gap — nothing draws `_x.mnxLab.fingering` — so what is under review there
is that the annotated notes engrave correctly without it, and an amber renderer-gap badge
is a legitimate thing to approve.

### 4. `core-guitar-technique` — technique becomes ink — **5 never-seen**

Owner: [core-guitar-technique.md](../complete/core-guitar-technique.md) (`09f5d55`,
2026-08-24; **closed the same day owing these approvals**). Scenarios:
`lab/tab-techniques/{bend-and-release, slides, hammer-pull-chain, vibrato-and-palm-mute,
natural-harmonics}` — all five, all four goldens each (`expected.primitives.json`,
`expected.svg`, `expected.tab.svg`, `expected.both.svg`). *`bend-and-release` left this
batch on 2026-08-30: its goldens moved again for the bend geometry, so it belongs to
batch 8 and its cause; the other four stay here.*

These were never-seen before this item and are never-seen after it, so nothing was
demoted — but the reason they are worth reading changed completely. Until 2026-08-24 each
one's `description` ended "the renderer does not draw X yet; the goldens pin the annotated
notes rendering cleanly". Now every one of the seven techniques is drawn, on **both**
staves, and the descriptions say what each mark is.

**What a reviewer should look for.** This is the first sweep in the corpus where the
question is *engraving taste*, not conformance — there is no spec reference engraving for
any of it, because none of these marks is standard MNX yet. Read `both` first; it is the
view a guitarist actually uses, and it is where the two staves' marks have to coexist.

- **Bends.** A bend is a CURVE (`points: [{position, alter}]`), so check the second bar of
  `bend-and-release`: a pre-bend must print as a vertical arrow with no rise before it,
  then a flat hold, then a release with a DOWNWARD arrowhead. If the two bars look like
  the same gesture twice, the curve is being flattened. Labels are in STEPS — "full" is
  one whole step, i.e. `alter: 2`. The span is deliberately clamped rather than drawn
  across the note's whole duration: uncapped, bar 1's arrow butted straight into bar 2's.
- **Slides.** Every slide in `slides` runs along ONE string, so the tab line is slanted on
  purpose — flat, it would sit on the string line and vanish. The legato pair carries an
  extra slur (picked once) and the shift pair does not; that difference is the whole
  scenario.
- **Hammer/pull.** On the notation staff the slur takes the side away from the stem, like
  any slur, while "H"/"P" stays above the staff. Check that no stem crosses a slur.
- **Vibrato and palm mute.** The wiggle should last the note and stop. "P.M." prints once
  per run of consecutive muted events with a dashed line to the run's end — the reading
  side of the open question in [docs/mnx-extensions.md](../../docs/mnx-extensions.md) about
  whether palm mute is a per-note flag or a span.
- **Harmonics.** The tab digit becomes `<12>`, which is WIDER than the 1.5sp rigid column
  the plan reserves for a fret. Nothing collides in this scenario; whether that holds in
  denser music is the open question the item recorded rather than solved.
- **Everywhere:** nothing reserves vertical room for these marks — the ink-measured gaps of
  batch 1 do it — so a system that opened up to fit a bend arrow is the mechanism working,
  not a layout bug.

### 5. `core-tuplets-grace-notes` — rhythm reaches the fingerboard — **3 never-seen**

Owner: [core-tuplets-grace-notes.md](../complete/core-tuplets-grace-notes.md) (built
2026-08-24; **closed the same day owing these approvals**). Scenarios:
`lab/tab-rhythm/{triplets-on-tab, grace-on-tab, unplayable-inside-a-tuplet}` — three new
scenarios in a new category, all four goldens each. Nothing existing moved: the tab staff
used to reserve a container's columns and draw nothing in them, and no scenario in the
corpus put a tuplet or a grace on a tab-opting part, so the change was invisible to every
committed golden until these three arrived.

**What a reviewer should look for.** Like batch 4 this is engraving taste with no spec
reference to check against — MNX has reference engravings for tuplets and graces on a
notation staff, and none at all for either on tab. Read `both` first and `tab` second; the
two views deliberately differ, and that difference is the main thing to agree with.

- **The bracket appears once per system.** In `tab` the tuplet bracket and its number are
  drawn over the tab staff, because a tab staff has no beams and nothing else can say
  where a group begins and ends. In `both` they are NOT — the notation staff directly
  above draws them over the same columns, and printing both would read as two gestures.
  Check that the one bracket in `both` sits over the notes it covers on both staves.
- **The quarter triplet is the one to look at.** In `triplets-on-tab` bar 2, its three
  digits span a half note, so its columns are wider than the eighth triplets' in bar 1 —
  but narrower than the two plain quarters beside them, because a tuplet's inner columns
  are RIGID (pre-scaled by the ratio) while a plain event's duration space is a spring
  that stretches into the justified line. That is inherited from the notation layout
  rather than decided here, and it is the most likely thing to be judged wrong: the
  question for a reviewer is whether a rigid triplet reads as cramped next to stretched
  neighbours, not whether the tab staff differs from the notation staff (it does not).
- **Grace digits are small — 0.6, the notation staff's own `GRACE_SCALE`.** They sit in
  the rigid small columns the plan already reserved for them, ahead of the note they
  decorate. In `grace-on-tab` check the two-note run before the closing chord: two small
  digits, evenly spaced, then a full-size chord — and check the tab digits still line up
  with the notation heads across the grace, which is the thing the shared plan buys.
- **No slash on a tab grace.** The notation staff draws one; the tab staff draws a small
  digit and nothing else, because there is no stem to slash. Whether a tab reader wants
  some other mark instead is an open question this item did not answer.
- **`unplayable-inside-a-tuplet` is the honesty exhibit.** Its triplet's middle note (E1)
  and its grace's note (fret 30) draw NO digit, and both carry a red badge. Two absences
  and two badges is the correct reading; a clamped digit at fret 0 or 24 would be the
  failure. Check the badges are red (error, not warning) and that the surrounding digits
  did not shift to close the gap.

## Settled

*Entries move here from* Open debt *when their scenarios leave the queue. Format: date of
the sweep, the batch, the counts, and anything the review taught that the next sweep should
know.*

- **2026-07-17 — the initial 57/57 sweep.** Predates this ledger; recorded in
  [lab-spec-approval.md](../complete/lab-spec-approval.md), which remains the recipe for
  verifying a renderer feature.

## Running a sweep

Drive it through the **`/verify`** skill — the conversational approval loop
(`.claude/skills/verify/`). It builds the queue, publishes one stable side-by-side review
page (our render, the spec's reference engraving where one exists, and a what-changed note
for stale items), takes verdicts as ordinary sentences, and records them through the
harness script. There is no human-facing CLI and no checkbox page, by design.

Point the sweep at a batch from the register rather than at the raw queue, and read that
batch's *what a reviewer should look for* first. When the sweep ends, update this file:
retire what settled, and adjust the counts in *Open debt* with the date you took them.
