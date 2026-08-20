# Instrument position — string, fingering, and everything derived

> **Status: design only (2026-08-02).** Nothing built, nothing raised with the CG.
> This is a working record of a design conversation, kept so the reasoning is not
> re-derived. The *initial* CG discussion is deliberately narrower than this doc
> and does not mention the derivation thesis.
>
> Sibling docs: [core-guitar-technique.md](core-guitar-technique.md) covers what the *hands
> do* (bends, slides, harmonics); this covers **where the note is played**.
> [docs/mnx-extensions.md](../../docs/mnx-extensions.md) records what is actually
> built today — and it differs from this design in one important way (see
> [Tension with what is built](#tension-with-what-is-built)).

## The frame

MNX describes **what to play** in great detail and has no way to describe **how to
produce it on an instrument**. That is the pitch, and it is deliberately not
phrased as "guitar tab support" — phrased generally it has four constituencies
(piano, guitar, bowed strings, harp) instead of one.

|  | Instrument-neutral | Instrument-specific |
|---|---|---|
| **Data** | which digit plays the note | which string it is played on |
| **Wanted by** | piano, guitar, violin, harp, organ | guitar, bass, uke, lute, all bowed strings |

`note.perform` exists in the schema as an **empty object** (`perform-options`,
no properties). Something was anticipated here and never filled in. Nobody has
publicly stated what for — [#337](https://github.com/w3c-cg/mnx/discussions/337)
asked whether MIDI performance data was intended and got no answer. That is a
question to ask, not an assumption to build on.

## Upstream state (checked 2026-08-02)

- **No discussion exists** on tab, strings or fretboards — all ~90 discussions checked.
- [#63 "Guitar Tab notation"](https://github.com/w3c-cg/mnx/issues/63) — open. The
  spec editor replied *"tab is intended for MNX… we haven't gotten into many of the
  details"* and **asked the reporter to break the problems into individual issues**.
  That never happened; the thread died after three comments. Any proposal here is
  answering a standing invitation, not competing with work in flight.
- [#179 "Open Harmonics between frets"](https://github.com/w3c-cg/mnx/issues/179) — open,
  one narrow slice.
- Pinned schema is `version/27`, 193 `$defs`. It contains **nothing** for hammer-on,
  pull-off, bend, slide, vibrato, harmonic, palm mute, fret, string or fingering.
  `note` carries exactly `accidentalDisplay perform pitch staff ties written`.
- But `event-markings` **already includes `bowDirection`** (`{direction: up|down, orient}`).
  The CG has already admitted a string-instrument-specific marking into the core
  vocabulary — and it is an *orchestral* string one. Useful precedent: the door is
  open, and the fretted family is the side that got nothing.

## The thesis: position is derived

**The string and the finger are choices. The fret and the hand position are
consequences.**

A pitch alone does not determine a location — A3 is string 5 fret 12, string 4
fret 7, or string 3 fret 2. Encoding the *string* resolves it, and the fret is
then arithmetic. The same shape holds on violin with fingering as the resolving
coordinate.

| Instrument | Given | Derives |
|---|---|---|
| Guitar | tuning + string + pitch | fret |
| Violin | tuning + string + pitch + finger | hand position |
| Any fretted | tuning | staff line count (one line per string) |

Worked examples:

- **Guitar.** Standard tuning, string 5 = A2. A3 is twelve semitones above → **fret 12**.
  Enharmonics do not disturb it: A♯3 and B♭3 both derive to fret 13, because the
  arithmetic runs on semitone distance, not spelling.
- **Violin.** D string, sounding A4. Finger 4 → 1st position; finger 3 → 2nd;
  finger 2 → 3rd; finger 1 → 4th. Same string, same pitch, disambiguated entirely
  by the fingering.

### Preconditions — where implementations will silently diverge

These are prose, not fields, and all three are load-bearing:

1. **Sounding vs written pitch.** Guitar is notated an octave above sounding. If
   tuning says string 6 = E2 and the note says E3, naive subtraction gives fret 12
   for an open string — silent, plausible, wrong. `part-transposition` already
   carries `interval`, `keyFifthsFlipAt` and **`prefersWrittenPitches`**, so the
   hook exists; the rule for how it composes with a string declaration must be stated.
2. **String numbering direction.** 1 = highest-pitched string (MusicXML's convention),
   which is the *opposite* of the visual tab convention (lowest line at the bottom).
   Unstated, every implementation guesses.
3. **Standard chromatic fret layout.** The derivation *is* the 12-EDO assumption. It is
   false on 19-EDO guitars, quarter-tone guitars, the saz, and movable-fret instruments,
   where fret 5 is simply the fifth fret and not five semitones. Connects to
   [#365 (EDO values)](https://github.com/w3c-cg/mnx/discussions/365).

### Why derivation rather than storing both

Not "derivable data should not be stored" — MNX stores plenty of derivable
presentation data (beams, hooks, stem directions), so that claim invites an
immediate counterexample.

The real argument is the **conflict rule**. If a file states a pitch *and* a fret,
they can disagree, and the spec must then adjudicate: which wins, does a validator
reject it, do you move the pitch or the finger? That is the same defect MNX already
rejected at staff scale — MusicXML's duplicated notation-plus-tab staves, where the
music exists twice and every consumer reconciles the copies. Storing pitch and fret
is that problem at note scale. Framing it this way aligns with a decision the CG has
already made.

**Free bonus:** a derived fret that comes out negative or past the last fret is a
*validation signal* — one of the few checks that catches a broken importer.

**Expected objection:** explicit redundancy is self-checking, and a consumer that
gets the tuning wrong derives every fret wrong with no signal. Fair. The answer is
that redundancy can be an *optional* field whose only role is validation — permitted
to be checked, never authoritative.

## The model

Seven points, locked:

1. **Tab is a view, not a clef.** `clef` requires `sign` (enum `C|F|G`) *and*
   `staffPosition`, neither of which means anything on a tab staff — a clef is a
   pitch-to-line mapping and tab has no pitch axis. A clef also cannot carry line
   count, and a tab staff has six lines, not five. Since line count derives from the
   string declaration, view + strings beats a new clef sign on both counts.
2. **Each string declares its open pitch**, with explicit string numbers (array order
   meaningless), plus the sounding/written statement above.
3. **Capo is one part-level integer.** Two jobs: shift the open-string pitches, and make
   derived fret numbers capo-relative (capo 3, printed fret 5 = absolute fret 8).
   Folding it into the string declaration loses the second job.
4. **A note states its string.** With 2 and 3, that derives the fret for any ordinary
   stopped note.
5. **A note states its finger.** On violin this derives the hand position. On guitar
   the fret already derives without it, so the finger is genuinely extra information
   about *how* the note is fretted — same field, different job per family.
6. **Natural harmonics still derive**, further than first assumed. String + sounding
   pitch determines the **partial** uniquely (within one string, partials are all
   distinct pitches). Only the **node** can be ambiguous, and only above the octave.
7. **Artificial harmonics need one explicit datum** — the left-hand stopped position.

### Points 5 and 6 in detail

**Violin position is derived-with-exceptions.** Extensions (stretching the 4th finger
a semitone without shifting) and half position mean the same string + pitch + finger
can occur in two hand frames. Also: this derives the *implied* position of a note; a
notated "III" over a passage is a separate directive object, out of scope.

**Natural harmonic nodes** (string 6, E2):

| Sounding | Partial | Node frets | Unique? |
|---|---|---|---|
| E3 | 2 | 12 | ✅ |
| B3 | 3 | 7, 19 | ❌ |
| E4 | 4 | 5, 24 | ❌ |
| G♯4 | 5 | 4, 9, 16 | ❌ |
| B4 | 6 | ~3.2 | ✅ in practice |
| D5 | 7 | ~2.7 | ✅ in practice |

So derivation runs pitch → location as usual; it just runs through the harmonic
series instead of the chromatic scale, and lands on a set rather than a value.
"Lowest node" is a good default, for the same reason lowest-reasonable-position is a
good default for stopped notes. Two consequences:

- The tiebreaker **cannot be an integer fret** — the 6th and 7th partial nodes sit
  between frets. Pitch-valued, which also covers fretless and bowed instruments.
- **Temperament.** The 5th partial is ~14¢ flat of an equal-tempered major third, the
  7th ~31¢ flat. Notation writes the nearest spellable note regardless, so any
  derivation clause resolves to the notated approximation.

**Artificial harmonics.** A touch-octave artificial harmonic sounds **one octave above
the fretted note** (stop at fret N, touch at N+12). Sounding pitch alone gives one
equation with two unknowns — stopped pitch and touch interval — and it cannot be
solved from the touch side either: for the touch-octave case the touching pitch
*equals* the sounding pitch, so stating it conveys nothing. Therefore state the
left-hand stop, derive the touch from the interval, tiebreak for non-octave partials
(touch at N+7 → +19; N+5 → +24). Express the stop as a **pitch, not a fret**, so it
works on violin, where artificial harmonics are standard and there are no frets.

## Naming, tested against piano

| Concept | Name | Level | Piano |
|---|---|---|---|
| open pitch per string | `part.strings[]` | part | absent |
| capo | `part.capo` | part | absent |
| which string | `note.string` (def `string-number`) | note | absent |
| which finger | `note.fingering` | note | **the whole point** |
| show as tab | placement question, below | layout | absent |

The piano lens sorts the fields into universal and string-specific, and the sorting is
the design: **exactly one name survives it, and that one must not be nested inside a
string or tab object.** `note.tab.fingering` makes a pianist import a fretboard concept
and reverts the proposal to guitar-only. Flat on `note`, peer to `pitch` and `staff`.

**`note.fingering: { hand?, finger }`** — piano reads `{hand: "left", finger: "3"}`
naturally. `hand` optional because the staff usually implies it, present because
cross-hand passages need it.

- **`left | right` is the correct axis, and piano proves it.** The string-instrument
  alternatives (`fretting`/`plucking`, `stopping`/`sounding`) are meaningless where one
  finger does both jobs. Bonus: guitar's right-hand p-i-m-a becomes `hand: right` on the
  same object, so **one field subsumes both of MusicXML's `<fingering>` and `<pluck>`**.
- **`finger` is a plain string**, not an integer: piano 1–5, guitar 1–4 plus T, violin
  0–4 where 0 is open, classical right hand p-i-m-a. Precedent for shipping text where
  the vocabulary is unsettled: `dynamic-group.prefix`.
- **Fingering cannot be a marking.** `markings` sits on `event` and `notes` is an array
  under it, so a marking applies to the whole chord. Fingering is per-note by definition.
  This rules out the placement someone will suggest.
- Deferred: **substitutions** (1–3 on a held key). Singular for now.

**`part.strings[]`, not `part.tuning`** — "tuning" collides with temperament, and #365
is live, so the word is already spoken for. It also mirrors a precedent MNX set:
`part.kit` declares components mapped to staff positions and `kit-note.kitComponent`
references them. `part.strings` declaring numbers mapped to pitches with `note.string`
referencing them is the same shape at the same level.

**`note.string` with def `string-number`** — the property name is free, but `$defs/string`
is taken (it is literally `{"type": "string"}`, the text type). The existing convention
resolves it: `note.staff` is the property, `staff-number` is the def.

### Names to avoid

- **`position`** — semantically taken. Throughout MNX it means *metric* position
  (`arpeggio.position`, `positioned-clef.position` are both `rhythmic-position`). Violin
  "position" makes it a three-way collision.
- **`tab` as a namespace** — anything under it is unavailable to piano and violin by
  construction. Fine as a *value* (`"tablature"`), wrong as a container.

### Two open placement questions

- **Does any of this belong in `note.perform`?** Unknown until the CG says what it was
  reserved for. Default to flat on `note`.
- **Where does "show as tab" live?** `staffKind` on the part is the obvious answer and
  probably the wrong one — it is presentation, and MNX has a layout system for that.
  `staff-source` already maps a part onto a staff with `staff`, `voice` and `stem`. A
  rendering style there handles the notation-plus-tab pair elegantly: two staff sources,
  same part, different style, music encoded once. Worth asking rather than proposing.

## Capo: parallels and the mid-piece problem

The notated keyboard equivalent of a capo is **organ registration**, not a MIDI octave
switch. A 4' stop sounds an octave above the key pressed; a 16' an octave below — a
constant offset between physical action and sounding pitch, decided by instrument setup,
**and printed in the score**. A MIDI controller's octave button is not notated, and that
difference is the test for what belongs in a score format at all. The brass member of the
same family is the **natural horn's crook** — a physical device fitted to the instrument
that shifts every available pitch by a constant interval, and notated ("Horn in E♭").

Capo is not a pure offset and should not be folded into `part.transposition`:

- it re-origins the fret numbering (a notation consequence, not a pitch one);
- it changes what is playable — everything below it is gone and the open strings change,
  which is usually *why* a guitarist capos;
- it changes timbre.

But it does interact with transposition. Songbooks print "Capo 3" with chords written as
D–G–A meaning sounding F–B♭–C — written-in-shape-key, not written-at-sounding-pitch. Both
conventions circulate. `prefersWrittenPitches` is the existing hook; what is needed is a
statement of how capo composes with it, not a parallel mechanism.

**Mid-piece changes.** A capo can change between sections, and tuning can change too —
scordatura is standard orchestral practice (Danse Macabre retunes the E string down a
semitone), drop-D mid-song is routine. So part-level scalars are the wrong *long-term*
shape. Out of scope, but say so explicitly and name the pattern a later proposal follows:
`part-measure.clefs` is an array of `positioned-clef`, each with a `rhythmic-position`.
Clef, key, time and tempo are all "declared, then changeable at a position."

## Which instruments need this — and how it maps to wind and brass

**Encode the choice, not the consequence.** "Does the player need telling?" and "does this
need storing?" turn out to be the same test, which means the scope boundary and the
derivation thesis rest on one principle rather than two.

| Instrument | Places a given pitch can be played | Encode? |
|---|---|---|
| Guitar | up to 6 | yes — the string |
| Violin | up to 4 | yes — the string |
| Brass | usually 2+ valve/slide options | yes (out of scope) |
| Piano | 1 key, 5 candidate fingers | fingering only |
| Flute, clarinet | 1 standard, plus alternates | only the exceptions |
| **Tin whistle** | **1** | **no** |

**Tin whistle is the clarifying case.** A six-hole diatonic whistle has one fingering per
note in its range, so there is no decision to record. Whistle tab exists in method books,
but it is **pedagogy, not disambiguation** — it tells a beginner what they do not yet know,
rather than recording something the notation left out. And pedagogy needs no encoding for
the same reason the fret needs none: it derives. A whistle-tab renderer computes the hole
diagram from the pitch exactly as a tab renderer computes the fret from string plus pitch,
so beginner materials remain fully serviceable from a file containing nothing
whistle-specific.

### The pattern generalizes further than the fields do

The design's shape is *declare the instrument's selectors, state which one was chosen,
derive the rest from the pitch*:

| Family | Stated | Derived from pitch |
|---|---|---|
| Fretted | string | fret |
| Bowed | string + finger | hand position |
| **Brass** | **valve combination / slide position** | **which partial** |
| Woodwind | deviations only | the standard fingering |
| Keyboard | finger | — |

**Brass is structurally identical to a guitar harmonic.** A trumpet has seven tube lengths,
one per valve combination, each with its own harmonic series; the player selects a length,
then selects a partial with the embouchure. Trombone is the same with seven slide
positions. The ambiguity is the same too — most notes are reachable by more than one
(position, partial) pair, which is exactly why players annotate alternate positions. So the
harmonic-series machinery in point 6 above is not a guitar edge case; it is the core
mechanic of an entire family.

**Woodwind inverts the derivation and still obeys the principle.** There is a standard
fingering per note, so the fingering derives from the pitch; players annotate only
alternates (clarinet's thumb B♭ vs 1-and-1, oboe's forked F), trill fingerings, and
**multiphonics** — where the fingering *is* the content and the sounding pitches are the
result. Every family has one case where the physical action becomes primary and the pitch
derives from it: harmonics on strings, multiphonics on woodwind.

### What does not map

- **`note.fingering: {hand, finger}` is the boundary.** Woodwind fingering is a key/hole
  combination and brass "1-2" is a valve combination; neither is a digit. That valve 1 is
  operated by the index finger is a coincidence, not a meaning. Stuffing `"1-2"` into
  `finger` would even print correctly, but `hand: right` would be nonsense — the same
  category error as "pitch fingering", one family further out.
- **`part.strings[]` has no woodwind analogue**, and brass would need a declaration of tube
  lengths per valve combination, which is instrument identity rather than score setup.
- **Tab-as-a-view does not carry over.** Recorder and tin whistle tab are hole *diagrams*,
  not a numeric grid, so "line count derives from string count" has nothing to stand on.

### How to use this in the discussion

Signal the pattern, deliver the strings. One or two sentences — "the same shape appears in
brass, where a valve combination selects a fundamental and the pitch determines the
partial" — shows the design is not parochial and pre-empts *why are we designing this for
one family?*

But do not raise the generality too loudly: the live risk is that the CG decides the
general instrument-facing model should be designed first, at which point this proposal
becomes a prerequisite nobody is writing.

**Argument caution.** Do not reach for "derivable data should not be stored" — MNX stores
beams, beam hooks and stem directions, all derivable, and someone will say so within an
hour. The claim that holds is narrower and stronger: **there is no performer decision to
record.** A whistle player's fingering is not a choice they made; a guitarist's string is.
(This is a different argument from the conflict rule above, and both avoid the weak claim.)

## Scope

The set this proposal serves is defined by the criterion, not by a list: **instruments
where the same pitch is reachable more than one way.** That includes strings, brass and
keyboards-for-fingering, and excludes tin whistle by the same rule that excludes storing
the fret.

**In.** Tab as a view; the string declaration; capo; `note.string`; `note.fingering`;
the derivation rules and their three preconditions.

**Out**, each separable:

- **All playing technique** — bends, hammer-ons, pull-offs, slides, vibrato, harmonics,
  palm mute, let ring, tapping, tremolo bar, dead/ghost notes. None of it is needed to
  render a readable tab staff, and most is not string-specific anyway (slides, harmonics
  and vibrato exist on trombone and violin), so it belongs in a general articulations
  conversation. See [core-guitar-technique.md](core-guitar-technique.md).
- **The entire right hand** — pick vs fingers, stroke direction, p-i-m-a, strums, rakes,
  rasgueado, pick scrape. MusicXML already splits these (`<fingering>` left, `<pluck>`
  right), so scoping to the left hand follows an existing seam. Strums likely extend the
  existing `arpeggio` object (it already has `span: id-pair`, `direction`, `arrow`) rather
  than being a new concept.
- **Barre and position markers** — worth calling out explicitly because they *are*
  left-hand and readers will assume they are in. A barre is a span across strings; a
  position marker is a directive. Different object shapes.
- **Chord symbols and fretboard diagrams** — see [core-chord-symbols.md](core-chord-symbols.md)
  and [#110](https://github.com/w3c-cg/mnx/issues/110).
- **Bowing** — up/down bow already exists as `bowDirection`; sul tasto/ponticello, pizz.
  do not. Sharing fingering does not make it the same proposal.
- **Exotic geometry** — courses (12-string, lute), partial capos, non-12-EDO fret spacing.
- **Playback semantics.**
- **Tab engraving conventions** — rhythm stems below the staff, numbers on or between
  lines, rhythm-slash notation. Presentation.
- **Positioned capo/tuning changes** (above).

### Forward-compatibility clauses

Three sentences that cost nothing if never used, and prevent an amendment if they are:

1. Scope the derivation rule to **stopped notes** — "position is derived from string and
   pitch", not "fret equals semitones above the open string". Harmonics then *extend* the
   rule (derivation against the harmonic series) rather than carving an exception from it.
2. Allow an **optional explicit position** to override the derivation. Wanted anyway for
   validation; also the seam a harmonic's node tiebreak and an artificial harmonic's stop
   slot into. Pitch-valued, not an integer fret.
3. Define `pitch` as the **sounding** pitch, explicitly. If it were ever read as the
   stopped pitch, harmonics, pre-bends and capos break at once.

## Tension with what is built

`_x.mnxLab.tab` **stores `position: {string, fret}`** — both, explicitly — and both
converters round-trip it losslessly. This design says the fret should derive from the
string. That is a real divergence, and it is deliberate: the extension was shaped to
mirror MusicXML and Guitar Pro, which both store both, and the round trips depend on it.

If the derivation thesis survives CG contact, the migration is to keep `fret` as an
optional non-authoritative field (its validation role) rather than to delete it — the
converters keep working, and documents stay readable. Recorded here so the divergence
is a decision rather than a drift. **That migration is now planned** — without waiting
for the CG — in [core-derived-positions.md](../complete/core-derived-positions.md), which also specifies the
no-annotation fallback (derive string *and* fret from pitch alone, default tuning) as
renderer presentation rather than spec text.

## Open questions for the CG

1. Has anyone started on string-instrument support, formally or informally?
2. What was `note.perform` reserved for?
3. Is "tab is a view of single-source content" the direction, or is there a reason to keep
   MusicXML's duplicated-staff model?
4. Should the tab view live on `staff-source` (layout) rather than the part?
5. Does this want to be one proposal or several — (a) strings + tuning, (b) fingering,
   (c) technique as general articulations, (d) chord symbols and diagrams?
6. Is fingering acceptable as a *general* note property (piano, harp, bowed strings), with
   guitar as the motivating example rather than the scope?

Note that woodwind and brass "fingering" is a key/hole **combination** — a chart, not a
digit — and belongs on the part under a different name. Acknowledge it before a wind
player raises it.
