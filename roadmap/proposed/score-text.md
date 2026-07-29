# Text and labels in MNX: a positioned-direction proposal

> **Status: proposed design, nothing built.** This supersedes the *placement* half of
> [mnx-cg-proposals.md](mnx-cg-proposals.md) §3 — that doc argued for `rehearsal` and
> `section` as separate objects (still right) but hung them off the global measure with
> no location and no story for ordinary annotations (under-specified). Written against
> **MNX v27**, verified against the pinned spec sources in `vendor/mnx`.

## The problem

MNX cannot express the sentence "put the word *Intro* here."

Every place free text is legal in v27's 193 `$defs`:

| where | for |
|---|---|
| `event-lyric-line.text`, `lyric-line-label` | lyrics |
| `part-name`, `part-short-name`, `score-name`, `staff-label`, `voice-name` | naming |
| `kit-component.name`, `sound.name` | percussion kit, playback |
| `dynamic-group.prefix` / `.suffix` | "più", "sub." beside a dynamic |
| `multimeasure-rest.label` | override a bar count |
| `global-attrs._c` | *"an optional comment… similar function as XML or HTML comments"* |

Naming, lyrics, and two dynamics decorations. Everything a bar can carry is a typed
symbol: `barline ending fermata fine jump key number repeatEnd repeatStart segno tempos
time`. None of them holds text.

So rehearsal marks, section names, performance directions, chord symbols and analysis
have nowhere to go. `rehearsal`, `section`, `harmony`, `words`, `direction`, `text`,
`numeral`, `frame` are none of them `$defs`.

## Concept inventory

Soundslice exposes eleven text-ish concepts, all attachable to a beat in a voice. They do
not describe eleven things:

| Soundslice | actually is | MusicXML | GP7 (alphaTab) | MNX v27 |
|---|---|---|---|---|
| Outer/Inner Text × above/below | **generic text** + placement + scope | `<direction><words>` + `placement` + `system` | `Beat.text` (untyped, no placement) | ❌ |
| Section Name | typed structural label | `<words>` (untyped) | `MasterBar.section.text` | ❌ |
| Section Letter | typed index — *text with a border* | `<rehearsal>` — **"enclosure is square if not specified"** | `MasterBar.section.marker` | ❌ |
| Chord Name / Diagram | structured harmony | `<harmony>` + `<frame>` | `Beat.chordId` → `Chord` | ❌ |
| Roman Numeral | harmonic analysis | `<numeral>` (4.0, deprecates `<function>`) | ❌ | ❌ |
| Lyrics | lyrics | `<lyric>` | `Beat.lyrics` | ✅ |
| Drum Sticking | note technique | ❌ (Soundslice: *"MusicXML doesn't natively support sticking"*) | ❌ | ❌ |
| Bar commentary | editorial metadata | ❌ | ❌ | ~ `_c` is an XML-style comment |

### The insight: typing makes placement derivable

Render every one of these on a single beat and they stack in a deterministic order —
section letter, section name, chord, analysis, staff, sticking, lyric. The order is
deterministic **because each row is a different kind of thing**.

The only rows that need a manual above/below choice are the generic ones. Soundslice
needs an inner/outer axis *because its text is untyped*; it has to ask the user where to
put something it cannot identify. **Inner vs outer is a symptom, not a concept to port.**

This is the argument for typing over a generic styled-text object, and it is the same
conclusion MNX already reached for navigation: `segno` is an object, not the word
"Segno" with a font.

## Proposal: typed labels globally, generic directions per part

MNX already has two containers with a clear division of labour, and two attachment
idioms. Nothing new needs inventing.

| container | holds | attachment |
|---|---|---|
| `measure-global` | `barline ending fermata fine jump key number repeat* segno tempos time` | `location` (a `rhythmic-position`) |
| `part-measure` | `arpeggios beams clefs dynamics measureRepeat nonArpeggios ottavas sequences` | `position` + `staff` + `voice` + `orient` |

`segno`, `fine` and `jump` are score-wide marks with a `location` and no text.
`dynamic-group` and `ottava` are part-specific and carry `position`/`staff`/`voice`/`orient`
— exactly the "beat in a voice" attachment Soundslice uses.

### Score-wide structural labels → `measure-global`

```jsonc
{
  "rehearsal": { "location": { "fraction": [0, 4] }, "label": "A" },
  "section":   { "location": { "fraction": [0, 4] }, "label": "Verse" }
}
```

They join `segno`/`fine`/`jump` because they are the same kind of thing: a score-wide
structural marker, true for every part at that point. A rehearsal mark is an arbitrary
**index** into the score; a section name states what the music **is**. Renumbering marks
changes nothing musical; renaming Chorus to Verse changes what the piece is. Guitar Pro
conflates them in one `Section{marker, text}`; MusicXML types only the first.

No `enclosure` attribute. A rehearsal mark is boxed *because it is a rehearsal mark* —
the type carries the presentation, which is cleaner than MusicXML's `enclosure="square"`
default and keeps typography out of the document.

### Generic annotations → `part-measure`

```jsonc
{
  "directions": [
    { "position": { "fraction": [0, 4] }, "orient": "above",
      "staff": 1, "voice": "v1", "text": "Play 8x" },
    { "position": { "fraction": [3, 4] }, "orient": "below", "text": "rit." }
  ]
}
```

Shaped like `dynamic-group`: `position` required, `staff`/`voice`/`orient` optional.
`orient` is already MNX's settled placement concept — 19 objects carry it, and
`multi-staff-orientation` gives `above` / `below` / `auto` / `between`. That `between`
is a *superset* of Soundslice's four-way split: it handles grand-staff placement, which
inner/outer cannot express.

Optional `glyph` is worth considering — `segno` can override its symbol and
`dynamic-group` has `glyphs`, so a symbolic annotation (bracket, arrow) has precedent.

### Explicitly out of scope

**Harmony and analysis are not text.** Chord symbols carry structure (root, quality,
bass, degrees) that transposes; Roman numerals need a key. MusicXML agrees — `<harmony>`
is not a `<direction>`. They belong in their own proposal ([chord-symbols.md](chord-symbols.md),
CG issue #109).

**Typography.** MNX carries `color`, `glyph`/`glyphs`, `orient`, `staffPosition` and
`enclosure` (accidentals only). It has no `font`, `font-size`, `font-style`, `bold`,
`italic`, `justify`, `halign`, `valign` — probed, none exist. Soundslice's size/serif/italic
controls and MusicXML's full `text-formatting` group should stay out. Which is another
argument for typing: the type tells a renderer how to set the text, so the document
never has to.

## Conversion stress test

Round-tripped a MusicXML document with four directions in one bar through the real
converter (`converters/musicxml-mnx`), against the extension as built today:

| input | kind | outcome |
|---|---|---|
| `<rehearsal>A` | typed | **survived** |
| `<words>Intro` | section name | **lost** — silently overwritten |
| `<words font-size="18" font-style="italic">Play 8x` (voice 2) | generic | **lost** — no MNX home |
| `<words>rit.` (`placement="below"`) | generic | **misclassified as the section name**; placement flipped to above |

Three of four destroyed or corrupted. The importer's heuristic is positional — a `<words>`
before any note is a section name — so the last one in the bar wins and the rest vanish.

The corpus never catches this: across all three scores there is **at most one `<words>`
per bar**, and two of the three have none at all. The "lossless round trip" claim in
CLAUDE.md is true, and true only because nothing exercises the ambiguity.

### Which direction is lossier?

Both, differently — and the distinction matters for the design.

**MusicXML → MNX loses data, at volume.** MNX has one section and one rehearsal slot per
bar, no generic text, no placement, no staff/voice, no styling. `placement`, `system`,
`font-*`, `enclosure`, `justify`, `halign`/`valign`, `default-x/y` all evaporate. A
`<direction>` may hold several `<direction-type>` children; MNX has no way to say "these
render as one unit".

**MNX → MusicXML loses type, at the root.** Under this proposal a `section` has no
MusicXML element — it becomes `<words>`, indistinguishable from a generic direction.
Re-import and it comes back as a `direction`. MNX → MusicXML → MNX is therefore **not
identity-preserving for `section`**, no matter how good the converter is.

That asymmetry is worth stating in the CG proposal, because it is an argument *for*
adopting `section` rather than against: the type exists in Soundslice and in Guitar Pro,
and MusicXML's lack of it is a known gap rather than a considered decision. MNX adopting
a typed section would make it the only one of the three that can round-trip form labels
without a heuristic.

Fixing the import side needs the proposal itself: with `directions` available, a `<words>`
that isn't identifiable as a section has somewhere to land instead of being dropped.

## Alternatives considered

**A — one generic positioned text, no typed labels.** Smallest surface, covers anything.
But a section letter is then distinguished only by an `enclosure` attribute, which drags
typography in, and rehearsal marks stop being findable — you cannot index or renumber
what you cannot identify. MNX already rejected this shape for navigation.

**B — typed only, no generic escape hatch.** Purest, closest to `segno`/`fine`/`jump`.
But every real score has "Play 8x", "Solo", "let ring". With no home they go to `_x`, and
a spec that forces vendor extensions for ordinary content has failed at its job.

**D — one object with a `type` discriminator**, the `dynamic-group` shape. Extends by
enum rather than by new objects, and matches MNX's newest idiom. Rejected for a specific
reason: `dynamic-group` states five "only valid if type is X" rules that **the JSON
Schema does not enforce** — `{"type": "accent", "end": …}` validates today. Repeating the
pattern would make `{"type": "rehearsal", "voice": "v2"}` legal and meaningless. It also
flattens the score-wide/part-specific split that MNX's two containers already express.

## Consequences for `_x.mnxLab`

If this design is right, our v3 extension is wrong in three ways:

- `section` and `rehearsal` have no `location` — they attach to the bar, not a position in it.
- There is no home for a generic annotation, which is why the converter has to guess.
- `harmonies` sits on the **global** measure, but chord symbols in a multi-part score are
  usually a property of one part.

Realigning would be a breaking v4 and a load/upgrade path. Worth doing *before* proposing
upstream — a proposal that contradicts our own extension is a bad look, and the extension
is supposed to be a draft of the standard object rather than a private hack.

## Open questions

- Does `section` need a `location`? Sections almost always start at a barline. `segno`
  has one, so consistency says yes; it may be over-modelling.
- Should `directions` carry `glyph` for symbolic annotations?
- Is `rehearsal` one-per-bar, or an array? MusicXML allows several `<rehearsal>` in one
  `<direction>`. One seems right; worth confirming nobody has a counterexample.
- Bar commentary — editorial text that never engraves. `global-attrs._c` exists and is
  documented as an XML-style comment. Is that enough, or is non-printing annotation a
  distinct need?

## References

- CG issues: [#112](https://github.com/w3c-cg/mnx/issues/112) rehearsal marks (the spec
  editor asked for a proposal and nobody wrote one), [#377](https://github.com/w3c-cg/mnx/discussions/377),
  [#109](https://github.com/w3c-cg/mnx/issues/109) chord symbols
- MusicXML: [`<direction>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/direction/),
  [`<direction-type>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/direction-type/),
  [`<rehearsal>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/rehearsal/),
  [`<words>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/words/)
- Precedent for how a proposal lands: the dynamics rework, proposed → merged in three
  weeks; and [#529](https://github.com/w3c-cg/mnx/pull/529), ours, merged in a day.
