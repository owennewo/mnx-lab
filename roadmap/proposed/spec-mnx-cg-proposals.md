# Getting guitar features into MNX proper

> **Status (2026-07-26; refreshed 2026-08-20): the designs below are BUILT;
> the outward half is not.**
>
> §2 (house-style fixes), §3 (labels), §4 (chord symbols) and §5's data path all
> shipped as `_x.mnxLab` v3 — the extension has since evolved to **v5** (the
> [derived-positions](../complete/core-derived-positions.md) reshape: string
> authoritative, flat note-level fields) — see
> [docs/mnx-extensions.md](../../docs/mnx-extensions.md) for the current spec
> and register. The `_x` namespace was corrected, enum values camelCased, bends
> became curves, and harmonics + palm mute filled the gap that blocked the
> technique work. Both round trips stay lossless.
>
> **§3's placement design is superseded**: [spec-score-text.md](spec-score-text.md)
> keeps its separate `rehearsal`/`section` objects but replaces the
> no-location global-measure attachment with a positioned-direction model —
> post from that doc, not from §3. Rehearsal marks and section labels are now
> **drawn** (`src/engine/layout/scoreText.ts`); chord symbols and technique
> remain undrawn, tracked in [core-chord-symbols.md](core-chord-symbols.md)
> and [core-guitar-technique.md](core-guitar-technique.md).
>
> **What is left is §6 steps 1, 5 and 6**: join the CG and sign the CLA, then
> post the proposals. Nothing can be contributed upstream until the CLA is
> signed.
>
> The rest of this doc is the research and the argument each proposal rests on.

## Why this doc exists

We keep hitting the same wall: MNX v19 has no concept for the thing we need, so
it goes under `_x`, and `_x` is a dead end by design ("may be freely ignored or
deleted by consuming applications"). Four gaps now, all with real corpus
evidence. Before adding a fifth private field it's worth designing them the way
the CG designs things, so the extension is a *draft of the standard object*
rather than a local hack — and so adopting it later means deleting the `_x`
wrapper, not rewriting the data.

## 1. Where MNX actually is (checked 2026-07-26)

The CG is **actively shipping**, and these features are **open, unclaimed, and
explicitly invited**:

| MNX issue / discussion | State | What it says |
|---|---|---|
| [#109 Chord symbols](https://github.com/w3c-cg/mnx/issues/109) | open since 2018, 2 comments | Both commenters independently reject MusicXML's model. `dhoernel`: harmonies should have their own "harmony track" like LilyPond ChordMode, not hang off notes. `clnoel`: *"harmonies don't belong inside other parts. They always appear above the top staff… what if they don't have durations, but rather measure locations"* |
| [#112 Rehearsal marks](https://github.com/w3c-cg/mnx/issues/112) | open since 2018 | Stalled on one contested question (should the format encode *auto-lettering*?). `joeberkovitz`: the mark's literal content must always be provided; automation "has more to do with the way editing apps handle the mark… rather than about what the mark itself means" |
| [#377 Current status of rehearsal marks](https://github.com/w3c-cg/mnx/discussions/377) | Feb 2025 | Spec editor `adrianholovaty`: *"We haven't added that to the spec yet. **Suggestions welcome!** This one might be pretty straightforward."* `rpatters1` sketched a Finale-shaped proposal; nothing landed |
| [#63 Guitar Tab notation](https://github.com/w3c-cg/mnx/issues/63) | open since 2018 | `mdgood` names exactly two MusicXML failures to fix in MNX: **bends** are encoded unlike how notation software models them, and **vibrato / palm mute** ride on generic `<bracket>` instead of semantic elements |
| [#110 Fretboard diagrams](https://github.com/w3c-cg/mnx/issues/110) | open since 2018 | Open question: is a diagram a child of harmony, or its own thing? |
| [#179 Open harmonics between frets](https://github.com/w3c-cg/mnx/issues/179) | open | `mdgood`: MusicXML's `<harmonic>` *"would seem a likely candidate for redesign in MNX, as it has not been widely supported in software"* |
| [#459 Encoding formatted text](https://github.com/w3c-cg/mnx/discussions/459) | active, 16 comments, last June 2026 | The text model everything else waits on: a **flat array of chunks**, each `{type: "text"\|"smufl", text \| glyphs, style}` |

So: nobody has proposed any of this in the six years the issues have been open,
the editor has asked for a proposal on one of them, and we are sitting on the
only corpus that demonstrates the need.

### The acceptance template

[#518 Dynamics](https://github.com/w3c-cg/mnx/issues/518) is the most recent
feature to land — proposed 2026-05-26, in the schema 2026-06-16, three weeks.
Copy its shape:

1. **A prose attribute list**, each attribute typed by **linking an existing MNX
   object** (`rhythmic-position`, `staff-number`, `voice-name`, `measure-rhythmic-position`).
2. **Worked examples**: a screenshot of real engraving beside the JSON that
   encodes it. Every contested point in the thread was settled by an example
   somebody couldn't encode.
3. **A closed semantic enum plus a display escape hatch** — `value: "ppp"` is
   required, and anything outside the enum is carried as display override. This
   is the answer to core-chord-symbols.md's "structured or literal?" question: the CG
   has already ruled, and the ruling is *both, with structure required*.
4. **Spans end with `end: measure-rhythmic-position`, never a `duration`.** The
   proposal shipped with `duration`; `rpatters1` produced one engraving it
   couldn't encode and it was changed before merge. Don't re-propose `duration`.
5. **Plain `string` for text, for now.** The proposal said `text` would use the
   #459 formatted-text object; what actually shipped in v19 is
   `dynamic-group.prefix` / `.suffix` as plain `string`. Formatted text is not
   in the schema yet, so new proposals should use `string` and note the
   migration — do **not** invent local styling.
6. **camelCase everywhere**, values included (`heavyLight`, `noBarline`).

### One practical prerequisite

`dspreadbury` asked `rpatters1` to formally join the Music Notation Community
Group and sign the Contributor License Agreement *before the group could use his
ideas*. Joining is free and possible as an unaffiliated individual. Do that
first, or the proposals can't be acted on.

## 2. What this repo should fix regardless

Four things in the current extension that would weaken a proposal, found while
checking it against the CG's own rules:

1. **`_x` keys are supposed to be vendor namespaces, not feature names.** The
   [global-attrs docs](https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/global-attrs/)
   say vendor keys "essentially serve as a namespace. An example might be a
   specific notation software package (e.g. `finale`), or a specific community
   of practice (e.g. `forteNumbers`)" — and
   [#429](https://github.com/w3c-cg/mnx/issues/429) is explicit that the key
   identifies "an agent, vendor, or community". We write `_x.tab` and
   `_x.section`, which claim two very generic tokens in a shared namespace.
   Another app writing `_x.tab` with different semantics would make our
   validator reject a legal document. **Recommend `_x.mnxLab.tab` /
   `_x.mnxLab.section`.** Mechanical but wide: schemas, both converters,
   `src/types/mnx.ts`, `upgradeTabExtension.ts`, the whole scenario corpus.
   (`rpatters1` asked the CG to maintain a registry of known vendor keys; a
   published, stable key is the thing worth having.)
2. **Enum values are hyphenated:** `pre-bend`, `slide-in`, `slide-out`. MNX house
   style is camelCase, and `rpatters1` made exactly this correction on #459.
   → `preBend`, `slideIn`, `slideOut`.
3. **The bend model can't hold a bend curve.** `technique.bend` is
   `{type, amount, release}` — MusicXML's shape. Guitar Pro stores a bend as an
   array of `(time, value)` points, and
   [the importer collapses it](../../converters/guitarpro-mnx/src/import/gp.ts)
   to `Math.max(...bendPoints)`, while
   [the exporter](../../converters/guitarpro-mnx/src/export/gp.ts) writes back a
   fixed two-point ramp. The round trip is lossless on our fixtures only because
   both files' bends happen to be simple ramps. A bend that rises, releases and
   rises again — routine in the Hal Leonard tab that #63 was opened about — is
   silently flattened. Since #63's headline complaint *is* bends, fixing this is
   the single most credible thing we could bring.
4. **Shape `_x` payloads exactly like the standard object being proposed**, so
   adoption is "delete the `_x` wrapper". `_x.tab.position` already does this;
   `_x.section` does not (see below).

## 3. Proposal A — section labels and rehearsal marks

**Where: `global.measures[i]`.** This is the easy one and it is already right in
principle — a rehearsal mark is score-wide by definition (its whole purpose is
that every player finds the same bar), which puts it in the same class as
`segno`, `fine`, `jump` and `key`, all of which live on the global measure.

**Two objects, not one.** Guitar Pro conflates them into `Section{marker, text}`
and we copied that, but they are different concepts that merely get drawn next
to each other:

```jsonc
// global.measures[i]
{
  "rehearsal": { "label": "A" },          // an index: arbitrary, renumberable, points at a bar
  "section":   { "label": "Verse 1" }     // a formal name: musical content, names a unit of the piece
}
```

- Renumbering every rehearsal mark changes nothing musical. Renaming "Chorus" to
  "Verse" changes what the piece *is*. Different concepts, so different objects.
- They co-occur: Broadway and guitar charts routinely print `[A] Verse`, and
  Guitar Pro can carry both on one bar.
- They map cleanly outward — `rehearsal` ⇄ MusicXML `<rehearsal>` (drawn boxed
  by convention) and GP `Section.marker`; `section` ⇄ `<words>` and
  `Section.text`.
- `label` is a plain `string` today, migrating to #459 formatted text later —
  per the dynamics precedent.
- Optional `location` (a `rhythmic-position`, default = start of the measure)
  for the rare mid-bar mark. `segno`/`fine`/`jump` require `location`; requiring
  it here is also defensible and costs an encoder nothing.

**Deliberately excluded, and this is the strategic point:** no `sequence`
auto-lettering enum, no `boxed`/enclosure. Auto-lettering is the *only* thing
#112 has ever argued about — it is what left the issue open for eight years.
Splitting it off means the uncontested 90% can land on its own; the automation
question can follow as a separate issue where it can stall harmlessly. Enclosure
is styling and belongs with the text/style work.

**`section` naming caution:** [discussion #513](https://github.com/w3c-cg/mnx/discussions/513)
uses "sections" for *instrument* groupings (the flute section). Expect to defend
the name or offer `formSection`.

**In this repo:** `_x.section {marker, text}` → `_x.mnxLab.rehearsal {label}` +
`_x.mnxLab.section {label}`. Small change to both converters and one field
rename, and it makes the extension a literal draft of the proposal.

## 4. Proposal B — chord symbols

**Where: `global.measures[i].harmonies[]`, an array parallel to `tempos`.**

```jsonc
// global.measures[i]
"harmonies": [
  {
    "location": { "fraction": [0, 4] },
    "root":     { "step": "A", "alter": 0 },
    "quality":  "minorSeventh",
    "bass":     { "step": "G" },
    "degrees":  [ { "value": 9, "alter": -1, "type": "alter" } ],
    "text":     "Am7♭5/G"
  }
]
```

- `location` — a `rhythmic-position`, required, exactly like `segno`/`fine`/`jump`.
  This is `clnoel`'s "measure locations rather than durations" from #110, in
  MNX's existing vocabulary. A chord has no duration; it lasts until the next one.
- `root` / `bass` — a new small object, `{step, alter}`: a `pitch` minus the
  octave, reusing the existing `step` and `alter` types.
- `quality` — a closed camelCase enum derived from MusicXML's `kind` list
  (`major`, `minor`, `dominantSeventh`, `halfDiminished`, `suspendedFourth`,
  `power`, …), plus `none` for N.C. and `other` for the unclassifiable. `root`
  is required except when `quality` is `none`.
- `degrees` — added/altered/omitted extensions, MusicXML's `<degree>` model,
  which is proven and hard to improve on.
- `text` — **optional** display override, the #518 escape hatch. Absent means
  "render it from the structure in your own house style", which is what real
  engravers want; present means "this exact string" for anything the structure
  can't say.

**Why global and not `part-measure`.** This is the one genuinely contestable
choice, so it needs the argument made up front. The recent trajectory runs the
other way: dynamics and ottavas were *moved out* of global into `part-measure`
([#408](https://github.com/w3c-cg/mnx/issues/408),
[#413](https://github.com/w3c-cg/mnx/issues/413)). The distinguishing test is
**can two parts legitimately disagree?**

- Dynamics, ottavas: yes — the flute can be *ff* while the cello is *pp*. Hence
  `part-measure`, with `staff` and `voice` to refine.
- Key, time, tempo, jumps, repeats: no — disagreement is a different feature
  request entirely ([#196](https://github.com/w3c-cg/mnx/issues/196)). Hence global.
- Harmony: **no.** Two parts printing different chords on the same beat is an
  error, not a valid encoding. Different *spellings* of the same chord are a
  display variant, not different data.

Two more supports. A key signature is already a global harmonic fact; chord
symbols are the same axis at finer resolution, so they belong beside it. And it
makes the chord-only chart natural — global harmonies over a part of full-measure
rests — which is the use case `dhoernel` opened with in #109. The cost is that
MNX doesn't say which staff draws a global object, but that is already true of
`tempos`; the proposal inherits an existing open question ([#246](https://github.com/w3c-cg/mnx/issues/246))
rather than creating a new one.

**Fretboard diagrams are not part of this** — and that answers #110's open
question directly. A diagram is not a property of the harmony; it is a
*realization* of that harmony on one instrument in one tuning, so it cannot be
global. It belongs on the part, referencing the harmony by `id` — the idiom MNX
already uses for `slur.target`, `tie.target` and `kit-component.sound`:

```jsonc
// part.measures[i]
"chordDiagrams": [
  { "harmony": "h-12-1", "frets": [ {"string": 1, "fret": 2}, … ], "barres": [ … ] }
]
```

This keeps the semantic layer instrument-independent and puts the
tuning-dependent part next to `part._x.tab.tuning`, where it can actually be
validated.

**Out of scope, worth naming so it isn't designed out:** roman-numeral /
Nashville function ([discussion #330](https://github.com/w3c-cg/mnx/discussions/330)
wants a tonal-centre object for exactly this) — a later `function` field drops in
cleanly.

## 5. Proposal C — technique, harmonics, palm mute

The framing that maximises acceptance: **quote #63 back at itself.** In 2018
`mdgood` listed the two things MNX should fix about MusicXML tab — bends encoded
unlike how software models them, and vibrato/palm-mute smuggled through generic
`<bracket>`. Our `_x.tab.technique` is a working implementation of that fix,
round-tripped losslessly against three real scores through two file formats.
That is a far stronger contribution than a design sketch, provided the bend
model is fixed first (finding 3 above).

**Technique is not a tab feature.** Slides, harmonics, vibrato and hammer-ons
exist on trombone, violin and harp; only `position` (string + fret) is genuinely
fretboard-specific. So the proposal should place technique at the **standard**
level, split by the shape of the thing rather than by instrument:

| Kind | Shape | MNX home | Precedent |
|---|---|---|---|
| hammerOn, pullOff, slide | note→note spanner | `note`, `target` = note id | `note.ties`, `slur.target` |
| harmonic | note property | `note.harmonic {type, touchingPitch}` | — |
| vibrato, palmMute, letRing | time span | `part-measure` array with `position` + `end` | `ottava`, `dynamic-group` |
| bend | a curve on one note | `note`, points array (see below) | — |

Two design points worth getting right:

- **Model harmonics by touching *pitch*, not touching fret.** MusicXML's
  base/touching/sounding pitch model is the one `mdgood` flagged for redesign in
  #179, but its use of *pitch* is the good part: it covers violin harmonics and
  the between-fret guitar harmonics that #179 is actually about, which a fret
  integer cannot express. The fret is already recoverable from `_x.tab.position`.
- **Model bends as a point curve**, `[{position, alter}, …]` over the note's
  duration, with pre-bend expressed as a point at position 0 and release as a
  descending final point. This is how Guitar Pro and every guitar editor stores
  them; MusicXML's single `<bend-alter>` is the model #63 complains about, and
  it is the model we currently copy.

**Meanwhile, in `_x.tab`** — the immediate gap is the 42 harmonics and 4 palm
mutes in `Vestapol.gpx` that are dropped today:

```jsonc
"technique": {
  "harmonic": { "type": "natural" },     // natural | artificial | pinch | tap | semi
  "palmMute": true                        // per-note for now; a span in the standard proposal
}
```

Per-note `palmMute` matches Guitar Pro's per-beat storage and round-trips
losslessly; the span form is the right *standard* design but would need
converting on both sides, so it is worth keeping the extension simple and saying
so explicitly. `staccato` and `ties` need no schema work at all — MNX already has
`markings.staccato` and `note.ties`, and the Guitar Pro importer simply doesn't
map them.

## 6. Suggested order

1. **Join the CG and sign the CLA.** Blocks everything else.
2. **Fix the four house-style findings** (§2). Cheap, and they are what a
   reviewer notices first.
3. **Propose section labels + rehearsal marks** (§3). Smallest, explicitly
   invited by the editor, and it exercises the whole path from our corpus to a
   spec change. Land this before spending credibility on the bigger two.
4. **Fill the `_x.tab` gaps** — harmonics, palm mute, bend curves — so
   `Vestapol` stops losing data, and so the technique proposal is backed by a
   shipping implementation rather than a sketch.
5. **Propose chord symbols** (§4), with `Vestapol`'s 25 symbols as the worked
   example and screenshots per the #518 template.
6. **Propose technique** (§5) onto #63, as one coherent "what a guitar score
   needs that MNX cannot express" write-up rather than four separate gaps.

Rendering none of this is a prerequisite for any of it — carrying the data
correctly is independently useful, and drawing it is tracked separately against
the [lab-spec-approval.md](../complete/lab-spec-approval.md) process.
