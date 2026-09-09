# Player timing and performance format

Implementation loop, player campaign item 3:
[Timing and pitch contracts](../roadmap/complete/core-player-timing-pitch.md).
These are lab performance conventions. The compiler (item 5) applies them to a
document; the transport (item 6) schedules their result. Neither exists yet.

## Exact time and failure policy

`src/audio/time.ts` owns reduced, immutable `{ num: bigint, den: bigint }` fractions.
Musical positions and durations use whole notes. `noteDuration` reads the existing
`model/durations.ts` table through its strict base lookup; renderer defaults do not
change. Dots and enclosing tuplet ratios are applied with exact arithmetic.

The budget is **512 bits per reduced component, 1,024 bits per intermediate,
32 enclosing tuplets, and 32 dots**. These limits are deliberate resource bounds,
not a claim about notation vocabulary. A depth/bit/dot overflow throws `TimingError`
with a `resource-limit` diagnostic. The compiler catches it at its outer boundary
and returns failure with diagnostics, without a partial performance. Malformed time
and unsafe number adapters similarly fail; they never substitute a quarter note,
round a rational, or keep compiling an approximate result.

The JSON form is `{ "num": "1", "den": "32" }`: reduced decimal strings, positive
denominator, zero exactly `0/1`. Deserialization rejects unreduced values, leading
zeros, exponent notation and negative denominators. `fromSafeFraction` and
`toSafeFraction` adapt the editor's structural `Onset` shape without importing
`edit/`; both components must fit safe integers. An already-rounded number cannot
be repaired by an adapter. `fromDecimal` interprets a finite number's decimal
spelling exactly, for fractional BPM and the existing dyadic duration table.

## Tempo and the clock boundary

Tempo is normalized to quarter BPM: `bpm × noteDuration(value) × 4`.
No mark means 120 quarter BPM. The last declared mark at an identical position wins.
`createTempoMap` integrates each segment before converting its result to seconds:
`wholeNotes × 240 / quarterBpm`. `secondsAt` has **no rate parameter**. Transport
applies rate exactly once relative to its play/seek anchor.

`positionAt(seconds)` is the inverse clock adapter. It rounds half-up to
**1/2^20 whole note**, at most half that unit from the inverse of the supplied
approximate seconds. At 120 BPM a grid unit is about 1.9 microseconds. This is a
returned display/seek position only; exact compiled events never go through that
rounding. Neither seconds nor this clock grid belongs in a performance golden.

`performedTempoChanges` honors mid-bar MNX locations. Its timed entries receive
actual measure lengths from the compiler so pickups are not guessed from a time
signature. A generic written-state lane supports tempo, time signature and each
resolved persistent dynamic scope. Every entry restores state at its written start,
including changes before a mid-bar segno and changes in a skipped ending. Changes
inside the half-open slice follow in order; changes at its end are outside the slice.
A zero-length slice projects no changes.

The compiler constructs separate lanes for resolved scopes. It must distinguish
persistent dynamic state (including an accent's residual state) from a one-shot
accent attack. Relative/gradual dynamics and scope resolution remain expression
work; the lane neither guesses their interpretation nor carries state from the
last visited bar across a jump.

## Timing conventions

| Case | Convention | Reason |
|---|---|---|
| Stealing grace | `min(1/32, neighbourDuration/2)`, proportional to grace notated durations; take the previous neighbour's end or following neighbour's start | Leaves the adjacent timed neighbour positive time |
| Missing grace neighbour | Silence plus `missing-grace-neighbour`; no borrowing across an unrelated jump or rest-only gap | Voice adjacency must be resolved by the compiler |
| Make-time grace | One shared `1/32` whole-note insertion per metric onset | Simultaneous groups do not multiply time |
| Fermata auto/normal | Multiplier `3/2` | Default hold |
| Fermata short/veryShort | Multiplier `5/4` | Short hold |
| Fermata long/veryLong | Multiplier `2` / `3` | Longer hold |
| Fermata none | Multiplier `1` | Explicitly no inserted time |
| Event fermata | Request `(multiplier − 1) × event span` at release | Each event contributes its requested extra time |
| Barline fermata | Request `(multiplier − 1) × 1/4` at the boundary | A quarter-note reference span |
| Concurrent fermatas | Maximum request at the metric point, not sum | A quarter and half ending together request `1/8` and `1/4`; insert `1/4` once |
| Tie | One sound span linked to all its written occurrences | A tied continuation still needs a cursor span |
| Let-ring tie | One whole-note ring budget, bounded by the next strike on that string | Fretted-instrument convention; compiler owns voice release |
| Tremolo | Subdivide by marks within the container's performed value | Compiler owns container expansion |
| Vibrato | One cycle per `1/10` whole note | 5 Hz at 120 quarter BPM; slows with tempo and transport rate |

`allocateGrace` requires an explicit grace kind; the compiler resolves an omitted
MNX grace type before calling it. `placeStealingGrace` returns both grace spans and
the shortened neighbouring span. Resolving ties, tremolo containers, string ownership,
and which timed neighbour is adjacent remains item 5's document work.

## Swing

`_x.mnxLab.swing` states a **ratio** on a unit (see
[mnx-extensions.md](mnx-extensions.md#swing-is-a-ratio-not-an-enum)), and
`src/audio/swing.ts` turns it into a warp of the metric axis rather than a
rewrite of notes. The pair `[0, 2u)` becomes `[0, 2u·a/(a+b))` and the
remainder, counted **from the barline**; a bar whose length leaves half a pair
over plays that remainder straight.

The warp is therefore **bar-local and duration-preserving**, and that is what
lets it sit under the rest of the compiler untouched. Bar starts are fixed
points, so measure spans, the tempo map and the fermata/make-time insertion map
all still see the axis they were written against; only offsets *inside* a bar
move. Everything downstream of `compilePerformance` — the transport, the native
sink, the MIDI writer, the playback cursor — inherits the feel with no code of
its own, because each consumes the compiled positions.

Order matters at one point only: the warp is applied where visits are built,
**before** grace stealing and hold insertion, so a grace note steals from the
duration its neighbour actually plays and a fermata is measured against the
swung release. A mid-bar tempo change moves with its offset, through the
written-state lane's `advance`.

| Case | Convention | Reason |
|---|---|---|
| Written identity | `metricOffset`/`metricDuration` stay written | A feel is how notes are played, never what they are |
| Bar length | Unchanged | The pair is a closed rearrangement; a whole bar sums to itself |
| Odd remainder | Played straight | Half a pair has no partner to trade with |
| Note across a pair | Unmoved | `2u` is a fixed point, so a quarter over a swung pair stays on the beat |
| Note inside a half | Warped proportionally | MusicXML leaves this undefined; a continuous warp puts it where a player would |
| Overfull bar | Straight past the declared length | The layouts already badge it; inventing a grid would move visible notes |

The played durations agree with Guitar Pro's: alphaTab renders `Triplet8th` as
a quarter-triplet plus an eighth-triplet (2:1 → `1/6` + `1/12`), `Dotted8th` as
a dotted eighth plus a sixteenth (3:1), and `Scottish8th` as the same pair
reversed (1:3). That is an independent oracle for the arithmetic, not a shared
implementation.

**Source-map consequence.** A source segment must be straight for a consumer to
read a played position back to a written offset by proportion, so swing cuts
each measure's segments at every run edge and each carries an optional
`scale` — played length ÷ written length, present only when it is not 1. The
reader is `metricOffset + (position − segment.position) / scale`. A document
that declares no swing emits no `scale` and its evidence is byte-identical to
what it was before swing existed.

## Source map and insertion order

Written metric offsets, unrolled metric positions and expanded performance positions
are separate quantities. `createInsertionMap` takes requests on the unrolled metric
axis, groups them by metric point and kind, and retains all contributing source
identities. Requests combine by maximum within a kind. At a shared point the order is:
**fermata, make-time grace, ordinary attacks**.

`toPerformance(point, edge)` exposes three boundaries: `before`, `afterFermata`,
and `after` (default). A principal onset and tempo change use `after`, so an insertion
at a tempo-change point uses the earlier tempo. Existing notes crossing either kind
extend through it. Notes releasing exactly at a fermata sustain through that hold;
notes releasing exactly at make-time remain released. `mapSpan` applies those rules.
Grace spans occupy their own make-time interval and do not inherit a coincident hold.

For a quarter-boundary `1/8` fermata and `1/32` make-time group, the hold occupies
`[1/4, 3/8)`, grace `[3/8, 13/32)`, and the principal starts at `13/32`. A note ending
at that quarter releases at `3/8`. A new quarter note starts at `13/32` and retains
its quarter duration. `locate` returns the insertion's source identities during a
hold/grace interval, otherwise its metric position; a hold does not invent another
written beat. The compiler splits ordinary source segments at insertions and applies
the same map to tempo changes and measure boundaries.

## Performance JSON version 1

The authoritative field definitions are in `src/audio/performanceTypes.ts`.
`Performance` uses BigInt fractions; `PerformanceJSON` uses canonical string pairs.
The top-level fields are `formatVersion: 1`, `written`, `sounding`, `tempo`,
`measures`, `sourceMap`, and `diagnostics`.

- `written`: `id`, `noteKey`, `ordinal`, original `metricOffset`/`metricDuration`,
  expanded `position`/`duration`, and `soundingIds`.
- `voices`: explicit part/string/kit metadata for channel allocation (item 5).
- `sounding`: `id`, `voice`, expanded `position`/`duration`, sounded `midi`,
  `velocity`, `curve`, and `writtenIds`. Future expression may supply
  `noReattack` and `timbre` hints. Curve offsets are relative to the sounding event;
  bend points carry cents and vibrato carries its rational period.
- `tempo`: expanded `position` and rational `quarterBpm`.
- `measures`: ordinal, written index, occurrence, iteration, resolved written
  `from`/`until`, unrolled metric start/span, and expanded start/span.
- `sourceMap`: ordinary metric segments with ordinal and original offset, or
  fermata/make-time intervals with metric position and contributing sources.
- `diagnostics`: code/message with optional ordinal and note key.

IDs are deterministic and unique within their respective list; links are reciprocal.
A tie from `a` to `b` has written IDs such as `a@0`, `b@1`, each linking to sound
`s0`; `s0.writtenIds` contains both. Tremolo reverses that relationship: a written
occurrence can link to several sounding IDs. Neither list can replace the other.
All temporal fields, including BPM and curve periods, use the canonical rational
pair; pitches, velocities and cents are scalar numbers. No seconds or MIDI ticks.

This item fixes the format without creating `expected.performance.json` files,
changing `renderHash`, or extending scenario approval metadata. Item 5 owns opt-in
flags, format validation/serialization, generated goldens and the complete review
and approval lifecycle. Engraving approval cannot approve this future evidence.

## Sounded pitch

`midiOf(note.pitch)` is the entire pitch conversion. The function takes no part,
clef, ottava, capo or harmonic argument. Corpus tests pin transposing parts, octave
clefs, ottavas and capo; hand-stated natural/artificial harmonic cases include and
omit `touchingPitch`. Fractional alterations and pitches outside MIDI's export range
are retained. Harmonic consistency diagnostics and timbre are item 8; bounded export
is item 5. Neither may rewrite the sounded pitch to make metadata agree.

The compiler and MIDI evidence lifecycle are implemented in
[player-performance.md](player-performance.md).
