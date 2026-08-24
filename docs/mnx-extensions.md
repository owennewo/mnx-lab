# MNX Lab extensions (`_x.mnxLab`) — v5

Everything this project carries that **W3C MNX v19 cannot express**, in one
place: what it is, why standard MNX has no field for it, which CG issue it
drafts, and how far it has been built.

Schema: [`spec/mnx-lab-extensions.schema.json`](../spec/mnx-lab-extensions.schema.json).
Strategy and the case for each design: [`roadmap/proposed/low-priority/spec-mnx-cg-proposals.md`](../roadmap/proposed/low-priority/spec-mnx-cg-proposals.md).
A live test bench rendering these documents runs at <https://mnx-lab.totai.uk>.

## The register

| Extension | What MNX v19 lacks | Drafts | Data path | Rendering |
|---|---|---|---|---|
| `string` (+ optional `fret`) | no string/fret anywhere; the clef enum is `C\|F\|G`, so `sign: "TAB"` is invalid | [#63](https://github.com/w3c-cg/mnx/issues/63) | ✅ both converters | ✅ tab staff |
| `strings[]`, `capo` | no instrument tuning of any kind | [#63](https://github.com/w3c-cg/mnx/issues/63) | ✅ both converters | ✅ |
| `tab.staffKind` | no way to say a part prefers a tab view | [#63](https://github.com/w3c-cg/mnx/issues/63) | ✅ both converters | ✅ |
| `tab.technique.bend` | nothing; and MusicXML's own model can't hold a curve | [#63](https://github.com/w3c-cg/mnx/issues/63) | ✅ both converters | ✅ both staves |
| `tab.technique.slide` / `hammerOn` / `pullOff` / `vibrato` | no articulation covers them | [#63](https://github.com/w3c-cg/mnx/issues/63) | ✅ both converters | ✅ both staves |
| `tab.technique.harmonic` | nothing; MusicXML's `<harmonic>` is a redesign candidate | [#179](https://github.com/w3c-cg/mnx/issues/179) | ✅ both converters | ✅ both staves |
| `tab.technique.palmMute` | nothing; MusicXML smuggles it through generic elements | [#63](https://github.com/w3c-cg/mnx/issues/63) | ✅ both converters | ✅ both staves |
| `fingering` | no fingering on notes | — | ⚠️ schema only | ❌ |
| `harmonies` | **no harmony concept anywhere** — no `root`, no `kind`, no chord | [#109](https://github.com/w3c-cg/mnx/issues/109) | ✅ both converters | ❌ |

**Graduated out of `_x` in v4:** `rehearsal` and `section`. They are no longer
extensions — they are written as the *standard* MNX objects proposed in
[roadmap/proposed/low-priority/spec-score-text.md](../roadmap/proposed/low-priority/spec-score-text.md), and validate
against `spec/mnx-schema.proposed.json` until the CG adopts them. An extension
is supposed to be a draft of the standard object; keeping a private copy after
drafting one would mean two spellings of the same fact. The same doc adds
`directions` for ordinary annotations, which `_x` never covered at all.

Not built, and deliberately: **fretboard diagrams** ([#110](https://github.com/w3c-cg/mnx/issues/110)).
They belong on the *part*, referencing a harmony by id, because a diagram
depends on the tuning — but no file in the corpus fills one in, so there is
nothing to verify an implementation against.

## Design principles

1. **Documents stay valid MNX.** Everything lives under the `_x` vendor hook
   the official schema already provides on every object. A consumer that knows
   nothing about any of this sees an ordinary, valid MNX document.

2. **One vendor key.** `_x` sub-keys name an **agent, vendor or community**
   ([#429](https://github.com/w3c-cg/mnx/issues/429); the
   [global-attrs docs](https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/global-attrs/)
   say "vendor keys are strings that essentially serve as a namespace"), not a
   feature. v2 wrote `_x.tab` and `_x.section`, which claimed two very generic
   tokens in a shared namespace — another app writing `_x.tab` for something
   else would have made our own validator reject a legal document.

3. **Each block is a draft of the standard object it wants to become**, so
   adopting one upstream means *deleting the `_x.mnxLab` wrapper*, not
   rewriting the data. Concretely that means using MNX's own vocabulary:
   `rhythmic-position` for metric positions, id references for spanner targets,
   `pitch.alter` semitones for pitch offsets, camelCase for every name and enum
   value, plain `string` for text (formatted text isn't in the schema yet —
   `dynamic-group.prefix` shipped as a plain string for the same reason).

4. **Structured *and* literal.** Where a source states something only as
   display text, the structure carries the semantics and a `text` field carries
   the literal — the pattern the CG settled on for dynamics in
   [#518](https://github.com/w3c-cg/mnx/issues/518). Neither alone is enough:
   structure alone cannot round-trip an odd spelling, text alone cannot
   transpose.

5. **Domain-named, not instrument-named.** The namespace is `tab`, not
   `guitar`: strings, frets, tunings and capos apply equally to bass, banjo,
   ukulele, mandolin, lute. Nothing assumes six strings.

6. **Orthogonal concerns stay separable**, so each can migrate into standard
   MNX on its own schedule: `string` is the only genuinely fretboard-specific
   datum, `technique` is meaningful for any instrument, `fingering` is universal.
   v5 makes the separation structural: the universal fields sit **flat** on the
   vendor dict, mirroring the flat-on-`note` adopted shape they draft
   ([roadmap/proposed/low-priority/spec-instrument-position.md](../roadmap/proposed/low-priority/spec-instrument-position.md))
   — nesting them under `tab` made them fretboard-scoped by construction.

## Note level: `note._x.mnxLab`

```jsonc
{
  "id": "n-2-1-0",
  "pitch": { "step": "E", "octave": 4 },
  "_x": {
    "mnxLab": {
      "string": 2,
      "fret": 5,
      "fingering": { "hand": "left", "finger": "1" },
      "tab": {
        "technique": {
          "bend":     { "points": [{ "position": 0, "alter": 0 }, { "position": 1, "alter": 2 }] },
          "slide":    { "type": "legato", "direction": "up", "target": "n-2-1-1" },
          "hammerOn": { "target": "n-2-1-1" },
          "pullOff":  { "target": "n-2-1-1" },
          "vibrato":  true,
          "harmonic": { "type": "natural" },
          "palmMute": true
        }
      }
    }
  }
}
```

- `string`: 1 = the **highest-pitched** string (E4 on a standard guitar). This
  matches MusicXML's `<string>` convention; note it is the opposite of the
  visual tab convention (lowest line at the bottom). The string is the
  performer's authoritative **choice**; given the part's `strings` declaration,
  the capo and the pitch, the fret is derived arithmetic.
- `fret`: **optional and non-authoritative** — its only job is validation (a
  mismatch with the derived fret typically means a broken importer). 0 = open
  string; fret numbers are relative to the capo. It requires `string` (a bare
  fret is meaningless). Both converters keep writing it, because MusicXML and
  Guitar Pro both store both. See
  [roadmap/complete/core-derived-positions.md](../roadmap/complete/core-derived-positions.md).
- A chord must not assign two of its notes the same `string`.
- Rests never carry a fingerboard annotation.

### Bends are curves

`bend.points` is an ordered list of `{position, alter}`:

- `position` — where in the note the point falls, as a fraction of the note's
  own duration (0 = onset, 1 = release).
- `alter` — offset from the written pitch **in semitones**, the unit of MNX's
  own `pitch.alter`. Non-integers are legal: a quarter-tone curl is `0.5`.

A **pre-bend** is a first point at position 0 with a non-zero alter. A
**release** is any later point whose alter decreases. This replaces v2's
`{type, amount, release}` — a MusicXML-shaped model that could not state a bend
that rises, releases and rises again, which is routine in the Hal Leonard tab
that [#63](https://github.com/w3c-cg/mnx/issues/63) was opened about.

Units differ at every hop, and this is the easiest thing to get silently wrong.
One whole step is:

| Format | Value |
|---|---|
| MusicXML `<bend-alter>` | `2` (semitones) |
| **This extension** | `2` (semitones) |
| alphaTab `BendPoint.value` | `4` (quarter tones) |

### Harmonics are identified by touching pitch

`harmonic.touchingPitch` is a pitch, not a fret. That is MusicXML's model, it
covers fretless instruments, and it can state the between-fret nodes that
[#179](https://github.com/w3c-cg/mnx/issues/179) is about — which a fret integer
cannot. The fret, when there is one, is already in `position`.

`type` is `natural | artificial | pinch | tap | semi | feedback`. MusicXML knows
only the first two; the other four are Guitar Pro's.

## Part level: `part._x.mnxLab`

```jsonc
{
  "name": "Guitar",
  "_x": {
    "mnxLab": {
      "strings": [
        { "string": 1, "pitch": { "step": "E", "octave": 4 } },
        { "string": 2, "pitch": { "step": "B", "octave": 3 } },
        { "string": 3, "pitch": { "step": "G", "octave": 3 } },
        { "string": 4, "pitch": { "step": "D", "octave": 3 } },
        { "string": 5, "pitch": { "step": "A", "octave": 2 } },
        { "string": 6, "pitch": { "step": "E", "octave": 2 } }
      ],
      "capo": 0,
      "tab": { "staffKind": "both" }
    }
  },
  "measures": [ ... ]
}
```

- **Single-source encoding: tab is a *view*, not *content*.** MusicXML encodes
  notation + TAB as two staves with the music duplicated, and every consumer
  must reconcile the copies. MNX's core premise is the separation of semantic
  content from presentation — so the music is encoded **once**, notes carry
  fingerboard positions, and `staffKind` declares the preferred presentation.
  Consequently there is **no TAB clef**: a clef is a pitch-to-line mapping, and
  a tab staff has no pitch axis. (`{"sign": "TAB"}` is also invalid against the
  MNX schema's `C|F|G` enum — see the `lab/tab-spec-gaps` scenario.)
- `strings` entries carry **explicit string numbers**; array order is
  meaningless. Sounding pitches, before the capo. **Absent ⇒ no fingerboard**:
  no consumer assumes an instrument — tab views require a declaration, or a
  viewer-supplied override (presentation only, never written back). The old
  "absent ⇒ standard guitar" default is retired; the load-time shim stamps the
  declaration into older documents that relied on it. Named `strings`, not
  "tuning": temperament work
  ([#365](https://github.com/w3c-cg/mnx/discussions/365)) already claims that
  word, and the shape mirrors MNX's own `part.kit` / `kit-note.kitComponent`
  precedent — declared numbers, referenced by `note._x.mnxLab.string`.
- `capo` shifts every open-string pitch up AND re-origins printed fret numbers
  (fret numbers are capo-relative).
- `tab.staffKind` (`notation | tab | both`, default `notation`) is a *hint*,
  not a command — interactive consumers may expose a view toggle that overrides
  it. It stays under `tab` because its adopted home is undecided (possibly
  `staff-source` — presentation, not part setup).
  **Who consults it**: `<mnx-score-viewer view="auto">` (the default) resolves
  it — `both` → the composed system, `tab` → tab, absent/`notation` →
  notation — so a bare element plus a document shows the author's intended
  view with no host code. The precedence is
  `host attribute > this hint > built-in default`
  ([docs/core-viewer-surface.md](core-viewer-surface.md)), which is what keeps
  it a hint: naming a view outranks it, always. One override it cannot beat:
  tab needs KNOWN strings, so a part declaring `tab` without `strings[]` (and
  without a viewer override supplying them) still renders notation — no
  instrument is ever assumed. `declaredStaffKind()` in `src/model/mnx.ts` is
  the single reading of this field; the engine's tab gate uses the same one.

## Global measure: `global.measures[i]._x.mnxLab`

```jsonc
{
  "_x": {
    "mnxLab": {
      "harmonies": [
        {
          "location": { "fraction": [0, 4] },
          "root":     { "step": "A", "alter": 0 },
          "quality":  "minorSeventh",
          "bass":     { "step": "G" },
          "degrees":  [{ "value": 9, "alter": -1, "type": "alter" }],
          "text":     "Am7b5/G"
        }
      ]
    }
  }
}
```

### `rehearsal` and `section` left in v4

Both moved out of the vendor dict and into standard MNX shape — see
[roadmap/proposed/low-priority/spec-score-text.md](../roadmap/proposed/low-priority/spec-score-text.md) for the design
and [spec/HISTORY.md](../spec/HISTORY.md) for the version history. The
argument for keeping them *separate* still holds and now lives in the proposal:
a rehearsal mark is an arbitrary index into the score, a section name states what
the music is, and they co-occur (`[A] Verse`).

Saved documents are migrated by the v3 → v4 hop in
[src/utils/upgradeTabExtension.ts](../src/utils/upgradeTabExtension.ts), which
promotes both and drops `_x` when nothing else is left in it.

### `harmonies` is on the global timeline

Not on the part. The test is **can two parts legitimately disagree?** Dynamics
can (flute *ff*, cello *pp*) — which is why the CG moved them out of `global`
into `part-measure`. Key, time and tempo cannot, and stayed global. Two parts
printing different chords on the same beat is an error, not an encoding. A key
signature is already a global harmonic fact; chord symbols are the same axis at
finer resolution.

The array is parallel to `tempos`, the other repeatable metrically-positioned
global object. `location` is required and there is no duration — a chord lasts
until the next one.

`quality` is camelCase of MusicXML's `kind` vocabulary, plus `none` (N.C.) and
`other`. `root` is required except for those two. `text` appears **only** when
the source's literal spelling differs from what a consumer would render from the
structure, so most chords carry none.

## Format mapping

| MusicXML | Guitar Pro (alphaTab) | This extension |
| --- | --- | --- |
| `<clef><sign>TAB</sign></clef>` + duplicated staff | `Staff.showTablature` | `tab.staffKind` (content encoded once) |
| `<staff-details><staff-tuning line="n">` | `Staff.stringTuning` | `strings[]` with explicit `string` |
| `<capo>` | `Staff.capo` | `capo` |
| `<technical><string>` / `<fret>` | `Note.string` / `Note.fret` | flat `string` / `fret` |
| run of `<bend>` gestures | `Note.bendPoints` | `technique.bend.points` |
| `<hammer-on type="start\|stop">` pair | `Note.isHammerPullOrigin` | `technique.hammerOn.target` (note id) |
| `<pull-off type="start\|stop">` pair | (same, split by pitch direction) | `technique.pullOff.target` |
| `<notations><slide>` pair / `<glissando>` | `Note.slideOutType` / `slideInType` | `technique.slide` |
| `<ornaments><wavy-line>` | `Note.vibrato` | `technique.vibrato` |
| `<technical><harmonic>` | `Note.harmonicType` | `technique.harmonic` |
| `<other-technical>palm-mute</other-technical>` | `Note.isPalmMute` | `technique.palmMute` |
| `<technical><fingering>` | — | `fingering` |
| `<direction-type><rehearsal>` | `MasterBar.section.marker` | `rehearsal.label` (standard, proposed) |
| `<direction-type><words>` | `MasterBar.section.text` | `section.label` (standard, proposed) |
| `<harmony>` | `Beat.text` / `Beat.chord.name` | `harmonies[]` |

Spanner-like techniques reference their destination by **note id** — the idiom
MNX uses for ties and slurs — instead of MusicXML's fragile paired `start`/`stop`
elements.

### What the round trips do and do not preserve

`MNX → .gp → MNX` and `MNX → MusicXML → MNX` are both lossless across the whole
corpus and tested as such. Three caveats worth knowing:

1. **Note ids are legitimately rewritten** by the MusicXML notation/TAB split,
   so technique targets must be compared by *which note they resolve to*, never
   by string equality.
2. **MusicXML cannot carry bend-point timing.** It has no way to say when a
   point in a curve falls, so points come back evenly spaced. The sequence of
   `alter` values is exact; the positions are normalised.
3. **MusicXML cannot carry a display override that contradicts the structure.**
   `<kind text>` holds only the *suffix* (`m7` in `Am7`), so a literal like
   `c/G` — a lowercase root, which is how one chord in House of the Rising Sun
   is actually spelled — comes back as `C/G`. The structure is preserved
   exactly; only the spelling normalises. Guitar Pro round trips keep it.

## Validation

Two independent verdicts, reported separately:

1. **Standard MNX validity** — the document against `spec/mnx-schema.json`.
   These extensions never affect it: `_x` content is unconstrained there by
   design.
2. **Extension validity** — every `_x.mnxLab` dict against this extension's
   schema, at each of its three placement points (note, part, global measure).
   Validating the whole dict rather than each feature block also catches a
   misspelled sibling key.

The validators are precompiled by
[`spec/tools/compile-validator.mjs`](../spec/tools/compile-validator.mjs) because
Cloudflare Workers cannot run `ajv.compile()`.

## Open questions (input wanted)

- Should `string` eventually live under standard MNX's `note.perform`
  (currently an empty placeholder object) rather than flat on `note`? Its
  existence suggests the CG intends performance data to live there.
- `palmMute` is per-note here, matching Guitar Pro. In standard MNX it should
  probably be a **span** on the part measure with `position` + `end`, like
  `ottava` and `dynamic-group` — as should `letRing`, which is not carried yet.
  The renderer already treats it as one: since 2026-08-24 it prints "P.M." once
  over a dashed line spanning each run of consecutive muted events, so the page
  says span while the model says flag. That gap is the argument for changing the
  model, not against the drawing.
- Techniques arguably belong in standard MNX as articulations and spanners
  rather than inside a tab extension: slides, harmonics and vibrato exist on
  trombone, violin and harp. Only the string is genuinely fretboard-specific.
  The renderer now acts on that reading — every technique draws on the
  **notation** staff too, so a document that declares no strings, has no
  fingerboard and no tab staff still engraves all of them
  ([core-guitar-technique.md](../roadmap/complete/core-guitar-technique.md)). If
  they were really tab features, that document would have nowhere to put them.
- Per-string courses (12-string, lute) and partial capos are out of scope.
- Roman-numeral / Nashville harmonic function is out of scope; a `function`
  field drops into `harmony` cleanly when
  [discussion #330](https://github.com/w3c-cg/mnx/discussions/330) settles.

## History

- **v5.1** (2026-08-07, same day): **instrument neutrality** — the
  "absent `strings[]` ⇒ standard guitar" default is retired. Absent strings
  now mean *no fingerboard*: tab rendering requires a document declaration or
  a viewer-level override (`<mnx-score-viewer>` `stringsOverride`/
  `capoOverride`). The upgrade shim materializes an explicit standard
  declaration into older tab documents (staffKind/capo/note-strings present,
  strings absent), and the MusicXML importer writes it for TAB parts without
  their own `<staff-tuning>`. Schema shape unchanged — only the meaning of
  absence.
- **v5** (2026-08-07): the tab sub-namespace flattened to the adopted shape it
  drafts ([roadmap/proposed/low-priority/spec-instrument-position.md](../roadmap/proposed/low-priority/spec-instrument-position.md)):
  `tab.position.{string,fret}` → flat `string`/`fret` (fret now **optional and
  non-authoritative** — validation only), `tab.fingering` → `fingering`,
  `tab.tuning` → `strings`, `tab.capo` → `capo`. Only `technique` (pending a
  general articulations proposal) and `staffKind` (adopted home undecided)
  remain under `tab`. Load-time migration is the v4 → v5 hop in
  `upgradeTabExtension.ts`; execution plan in
  [roadmap/complete/core-derived-positions.md](../roadmap/complete/core-derived-positions.md).
- **v4** (2026-07-29): `rehearsal` and `section` graduated out of `_x` into the
  standard MNX objects proposed in
  [roadmap/proposed/low-priority/spec-score-text.md](../roadmap/proposed/low-priority/spec-score-text.md); the vendor
  dict on a global measure now holds `harmonies` only. Load-time migration is the
  v3 → v4 hop in `upgradeTabExtension.ts`.
- **v3** (2026-07-26): namespace `_x.tab` / `_x.section` → the single vendor key
  `_x.mnxLab`; `section{marker,text}` split into `rehearsal` + `section`, each
  with a `label`; added `harmonies`, `technique.harmonic`, `technique.palmMute`;
  bends became curves in semitones; slide enum values camelCased
  (`slide-in` → `slideIn`).
- **v2** (2026-06): namespace `_x.guitar` → `_x.tab`; split note annotation into
  `position`/`technique`/`fingering`; explicit string numbers in tuning; added
  `staffKind`, removed TAB-clef usage; `hammerOnPullOff` split into `hammerOn` /
  `pullOff`; single-source encoding. (Schema file
  `mnx-tab-extension.schema.json`, removed in v3; in git history.)
- **v1** (`guitar-tab-extension.schema.json`, deprecated): flat `_x.guitar`
  object, positional tuning array, TAB clefs carried over from MusicXML.

Saved documents are upgraded v1 → v2 → v3 on load by
[`src/utils/upgradeTabExtension.ts`](../src/utils/upgradeTabExtension.ts).
