# Tuplets and grace notes across the converters (and on tab)

> **Status: complete (2026-08-24).** Split out of
> [core-guitar-pro.md](core-guitar-pro.md) when that effort closed. It was the one
> genuine feature gap left there, and it was never Guitar-Pro-specific: **neither**
> converter carried tuplets or grace notes, and the tab renderer drew neither.
>
> Closed owing three approvals, registered as **batch 5** in the verification ledger
> [lab-verify.md](../inprogress/lab-verify.md) — the three new `lab/tab-rhythm/`
> scenarios, which are never-seen rather than demoted (nothing that was already
> approved moved; see *What did not move* below).

## Where the support stopped

The model and the notation renderer were never the gap — this was a converter and
tab-renderer story:

| Layer | Tuplets | Grace notes |
|---|---|---|
| `src/model/mnx.ts` (`MnxTuplet`, `MnxGrace`) | ✅ modelled | ✅ modelled |
| Notation layout (`engine/layout/notation.ts`) | ✅ drawn (`emitTuplet`, pre-scaled plan columns) | ✅ drawn (`GRACE_SCALE`, sits out beams) |
| Spec corpus | ✅ `spec/tuplets` | ✅ `spec/grace-note`, `spec/grace-notes-beamed`, `spec/beams-inner-grace-notes` |
| Tab layout (`engine/layout/tabStaff.ts`) | ~~columns reserved, nothing drawn~~ → **drawn** | ~~columns reserved, nothing drawn~~ → **drawn** |
| `converters/guitarpro-mnx` | ~~import flattens + `warn()`; export `warn()`s~~ → **both directions** | ~~both directions `warn()`~~ → **both directions** |
| `converters/musicxml-mnx` | ~~no handling at all~~ → **both directions** | ~~no handling at all~~ → **both directions** |

Neither old behaviour was silent, which is why this was a gap and not a bug: the Guitar
Pro importer flattened a tuplet and said so, and the exporter warned rather than dropped.
The MusicXML converter did not warn because it never looked.

## Why nothing caught it

**None of the three reference fixtures contains a tuplet or a grace note** —
`House-of-the-Rising-Sun`, `Sun-did-glide` and `Vestapol` are all zero for both. The round
trips were honestly lossless *on the material they carried*; they simply never presented
the case. Step zero was therefore a fixture, not code.

## What was built

### 1. The fixture — `Triplets-and-graces`

Four bars of ordinary guitar writing, each carrying one thing the other three fixtures
cannot: a control bar of plain quarters, two 3:2 eighth triplets beside two unflagged
quarters, an acciaccatura before a chord followed by a 3:2 **quarter** triplet, and a
six-note whole-note chord.

It is a real Guitar Pro file — `.gp` is GP7/GP8's native container, a zip whose
`Content/score.gpif` is the GPIF XML the app itself writes — but it is the only fixture
**not** authored in the app, and that trade is worth stating plainly. Guitar Pro was not
available to author a fourth `.gpx`, so the GPIF is emitted longhand by
[`converters/fixtures/tools/make-triplets-and-graces.mjs`](../../converters/fixtures/tools/make-triplets-and-graces.mjs),
which imports nothing from `src/` and writes string numbers in Guitar Pro's own direction
(0-based from the LOWEST string, the opposite end from `_x.mnxLab`). Two properties keep
it honest: alphaTab parses it with the same production GPIF reader that opens a musician's
file, so the import path under test is the real one; and because our exporter had no hand
in writing it, a sign error in `common/tuning.ts` cannot cancel itself out against it.

Bar 3 is the load-bearing bar. Its quarter triplet spans a half note, so a converter that
assumes tuplets are always eighths fails there; bar 2's triplets sit beside plain quarters
in the same bar, so a converter that flags a whole bar rather than a run fails there.

**What the fixture taught.** alphaTab NORMALISES a grace beat's written value by group
size (one grace ⇒ eighth, two ⇒ sixteenth, three or more ⇒ thirty-second), overwriting
whatever the file says. The fixture is authored as an eighth to match, because authoring
anything else would encode a value no reader ever sees.

### 2. Guitar Pro, both directions

The collapse/expand asymmetry already solved for **voltas** (declared once in MNX, flagged
per bar in Guitar Pro), followed rather than reinvented: import buffers a run of flagged
beats and flushes it as one container, export writes one container back out as N flagged
beats.

The one thing worth copying from this: **alphaTab already decides which flagged beats form
one group** (`Beat.tupletGroup`, filled by written duration), so six flagged eighths are
two triplets and not one six-note tuplet. Following its grouping rather than re-deriving
one from the raw flags is what keeps the two agreeing — and re-deriving it is the obvious
wrong turn, because the flags alone genuinely cannot tell those two readings apart.

### 3. MusicXML, both directions

`<time-modification>` + the `<tuplet>` bracket, and `<grace>` with no `<duration>`.

Three things this direction forced, none of them obvious from the outside:

- **`<divisions>` is raised for the document.** Divisions count per quarter, and a triplet
  eighth at the default 8 is 4 × 2/3 — not an integer, and rounding it is how a bar ends up
  a division short. `divisionsFor()` multiplies by the least common multiple of the
  document's tuplet ratios up front. Raising divisions is free; discovering the shortfall
  per measure is not.
- **Both conventions are accepted on import**, exactly the trap the volta work hit. An
  exporter that writes `<tuplet type="start"/>` says where a group begins; one that writes
  only `<time-modification>` does not, and plenty do. Trusting the brackets alone would
  merge six triplet eighths into one six-note tuplet playing at two thirds the right
  length, so group boundaries fall back to the ratio plus accumulated written time.
  `roundtrip.test.ts` strips every `<tuplet>` element and asserts the two triplets survive.
- **The grace steal direction rides on `slash`**, the universal convention and the only one
  real exporters write: a slashed grace is the acciaccatura crushed in before the beat, an
  unslashed one the appoggiatura that delays what follows. MNX names `graceType` and
  `slash` independently, so an unusual pairing normalises — the same trade this converter
  already documents for legato slides. The explicit `steal-time-previous` /
  `steal-time-following` / `make-time` attributes are read when present.

**What this direction taught.** `@xmldom/xmldom` returns `''` — not `null` — for an
attribute that is not there, so `getAttribute(x) !== null` reads every grace note as
carrying every attribute at once. `hasAttribute` is the check.

### 4. Tab rendering

`emitTabVoices` now walks containers. The plan reserved ONE slot for a container — its
first inner column — and the inner columns are walked from `spacing.ts`'s own widths
(`tupletColumns`, `GRACE_NOTE_ADVANCE_SP`), the same numbers the notation layout walks. A
walk that disagreed by one term would slide every digit after the first out of column with
the staff above, and the golden would happily pin the wrong answer, which is why
`tab-containers.test.ts` compares the two staves' column SPACING directly.

- **Grace digits are small** (0.6, the notation staff's own `GRACE_SCALE`) and take no
  technique ordinal: a grace is never the origin or destination beat of a hammer-on, and
  numbering it would shift every technique after it.
- **The tuplet bracket is drawn once per system.** The standalone tab view draws its own —
  a tab staff has no beams, so the bracket is the only thing that can say where a group is.
  The `both` view does not, because the notation staff above draws it over the same
  columns. That is the `showTupletBrackets` argument, and it is the only behavioural
  difference between the two callers.

**A correctness bug this uncovered.** `validate.ts` stopped at the first container and
abandoned the rest of the voice, so an unplayable note inside one got no badge — and now
that tab DRAWS container notes, it would also have drawn nothing, which is a silent drop
of exactly the kind this codebase forbids. The check descends now (scaling onsets by the
tuplet ratio inside a group; a grace claims no string at any onset, because it is not
sounded with the note it decorates), and `lab/tab-rhythm/unplayable-inside-a-tuplet` is
the exhibit.

### 5. Scenarios

A new category, `lab/tab-rhythm` — "Rhythm on the fingerboard". Three scenarios:
`triplets-on-tab`, `grace-on-tab`, `unplayable-inside-a-tuplet`. Registered as ledger
batch 5 with what a reviewer should look for.

## What did not move

**Not one committed golden.** The tab staff used to reserve a container's columns and draw
nothing in them, and no scenario in the corpus put a tuplet or a grace on a tab-opting
part — so until the three new scenarios arrived, teaching tab to draw them was invisible
to every hash in `scenarios/`. That is a satisfying result and a slightly alarming one:
the corpus could not see a whole class of content, and the only reason the gap closed
cleanly is that the goldens had nothing to say about it either way.

## Not this

Not nested tuplets (Guitar Pro's own model is shallow, and MNX tuplet content is events,
not containers — a grace inside a tuplet is emitted ahead of the group, with a warning).
Not tremolo on tab: that still reserves its columns and draws nothing, and it keeps the
separate gap it always had.

## Open questions this did not answer

- **A rigid triplet beside a stretched neighbour.** A tuplet's inner columns are rigid
  (pre-scaled by the ratio) while a plain event's duration space is a spring that stretches
  into the justified line, so a quarter triplet reads narrower than the plain quarters
  beside it. Inherited from the notation layout, not decided here — but tab is where it is
  most visible, because there are no beams or stems to distract from the spacing.
- **A tab grace has no slash.** The notation staff draws one; the tab staff draws a small
  digit and nothing else, there being no stem to slash. Whether a tab reader wants some
  other mark is untested.
- **Unequal tuplets** (a quarter and an eighth inside one triplet) are handled by both
  converters — both sides are restated against the longest note value that divides them —
  but no fixture or scenario contains one, so that path is proven by construction rather
  than by evidence. It is the same shape of hole this whole item was filed to close.
