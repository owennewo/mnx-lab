# MNX Tablature Extension (`_x.tab`) — v2

A vendor extension adding fretted-instrument tablature to [W3C MNX](https://w3c.github.io/mnx/docs/),
offered as a working straw man toward native tab support in the standard
([w3c-cg/mnx#63](https://github.com/w3c-cg/mnx/issues/63)). Schema:
[`schemas/mnx-tab-extension.schema.json`](../schemas/mnx-tab-extension.schema.json).
A live test bench rendering these documents runs at <https://mnx-lab.totai.uk>.

## Design principles

1. **Documents stay valid MNX.** Everything lives under the `_x` vendor hook the
   official schema already provides on every object. No new clef signs, no fields
   at the standard level. A consumer that knows nothing about tab sees an ordinary,
   valid MNX document and renders ordinary notation.

2. **Single-source encoding: tab is a *view*, not *content*.** MusicXML encodes
   notation + TAB as two staves with the music duplicated, and every consumer must
   reconcile the copies. MNX's core premise is the separation of semantic content
   from presentation — so this extension encodes the music **once**, annotates notes
   with fingerboard positions, and declares the preferred presentation with a
   part-level `staffKind` flag. Notation and tab are both derived projections of the
   same note stream. (Consequently there is **no TAB clef**: a clef is a pitch-to-line
   mapping, and a tab staff has no pitch axis. `{"sign": "TAB"}` is also invalid
   against the MNX schema's `C|F|G` enum.)

3. **Domain-named, not instrument-named.** The namespace is `tab`, not `guitar`:
   strings, frets, tunings and capos apply equally to bass, banjo, ukulele,
   mandolin, lute. Nothing in the extension assumes six strings.

4. **Orthogonal concerns stay separable.** A note's annotation splits into
   `position` (where on the fingerboard — the only genuinely tab-specific data),
   `technique` (bends, slides, hammer-ons — visible in *both* staff views, and
   meaningful for non-fretted instruments too), and `fingering` (universal — piano
   parts have fingering). Each block is optional and independent, so each can
   migrate into standard MNX on its own schedule without breaking the others.

5. **MusicXML semantics, MNX idioms.** The vocabulary maps 1:1 onto MusicXML's
   `<technical>` elements (see table below), but spanner-like techniques reference
   their destination by **note id** — the same idiom MNX uses for ties and slurs —
   instead of MusicXML's fragile paired `start`/`stop` elements.

## Note-level: `note._x.tab`

```jsonc
{
  "id": "n-2-1-0",
  "pitch": { "step": "E", "octave": 4 },
  "_x": {
    "tab": {
      "position":  { "string": 2, "fret": 5 },
      "technique": {
        "bend":     { "type": "bend", "amount": 1.0, "release": true },
        "slide":    { "type": "legato", "direction": "up", "target": "n-2-1-1" },
        "hammerOn": { "target": "n-2-1-1" },
        "pullOff":  { "target": "n-2-1-1" },
        "vibrato":  true
      },
      "fingering": { "hand": "left", "finger": "1" }
    }
  }
}
```

- `position.string`: 1 = the **highest-pitched** string (E4 on a standard guitar).
  This matches MusicXML's `<string>` convention; note it is the opposite of the
  visual tab convention (lowest line at the bottom).
- `position.fret`: 0 = open string. Fret numbers are relative to the capo if one
  is declared.
- `bend.type`: `bend` (strike then bend) or `pre-bend` (bend before striking).
  `release: true` means the bend returns to the unbent pitch — so MusicXML's
  "bend-release" is `{type: "bend", release: true}`.
- `slide.type`: `shift` (audible repick at arrival) or `legato`; `slide-in` /
  `slide-out` are untargeted slides from/to an indeterminate fret.
- A chord must not assign two of its notes the same `string`.
- Rests never carry `_x.tab`.

## Part-level: `part._x.tab`

```jsonc
{
  "name": "Guitar",
  "_x": {
    "tab": {
      "tuning": [
        { "string": 1, "pitch": { "step": "E", "octave": 4 } },
        { "string": 2, "pitch": { "step": "B", "octave": 3 } },
        { "string": 3, "pitch": { "step": "G", "octave": 3 } },
        { "string": 4, "pitch": { "step": "D", "octave": 3 } },
        { "string": 5, "pitch": { "step": "A", "octave": 2 } },
        { "string": 6, "pitch": { "step": "E", "octave": 2 } }
      ],
      "capo": 0,
      "staffKind": "both"
    }
  },
  "measures": [ ... ]
}
```

- `tuning` entries carry **explicit string numbers** — array order is meaningless.
  (v1 of this extension used a bare pitch array whose order convention was
  documented inconsistently and implemented both ways; this is the fix.)
  Sounding pitches; absent ⇒ standard guitar tuning.
- `staffKind` is the part's *preferred* presentation (`notation` | `tab` | `both`,
  default `notation`). It is a hint, not a command — interactive consumers may
  expose a view toggle that overrides it. This flag is the entire mechanism by
  which a part "is" a tab part; there is no tab clef and no second staff.

## MusicXML mapping

| MusicXML | This extension |
| --- | --- |
| `<clef><sign>TAB</sign></clef>` + duplicated TAB staff | `part._x.tab.staffKind` (no second staff; content encoded once) |
| `<staff-details><staff-tuning line="n">` | `tuning[]` entry with explicit `string` |
| `<capo>` | `capo` |
| `<technical><string>` / `<fret>` | `position.string` / `position.fret` |
| `<bend><bend-alter>` (+ `<release>`) | `technique.bend` (`amount` in whole steps, `release`) |
| `<pre-bend>` | `technique.bend.type: "pre-bend"` |
| `<hammer-on type="start|stop">` pair | `technique.hammerOn.target` (note-id reference) |
| `<pull-off type="start|stop">` pair | `technique.pullOff.target` |
| `<slide type="start|stop">` pair / `<glissando>` | `technique.slide` (`target` note-id) |
| `<technical><fingering>` etc. | `fingering` |
| `<ornaments><wavy-line>` / vibrato | `technique.vibrato` |

Bidirectional conversion (including regenerating MusicXML's two-staff TAB encoding
from the single-source form) is implemented in
[`converters/musicxml-mnx`](../converters/musicxml-mnx/).

## Validation

Two independent verdicts, reported separately:

1. **Standard MNX validity** — the document against the official schema
   (`schemas/mnx-schema.json`). The extension never affects this: `_x` content is
   unconstrained there by design.
2. **Extension validity** — every `part._x.tab` and `note._x.tab` object against
   this extension's schema.

## Open questions (input wanted)

- Should `position` eventually live under standard MNX's `note.perform` (currently
  an empty placeholder object) rather than `_x`? Its existence suggests the CG
  intends performance data to live there.
- Techniques (`bend`, `slide`, `hammerOn`, `pullOff`, `vibrato`) arguably belong in
  standard MNX as articulations/spanners — they are notation concerns beyond tab.
- Per-string courses (12-string, lute) and non-standard fret counts/partial capos
  are out of scope for v2.

## History

- **v2** (2026-06): namespace `_x.guitar` → `_x.tab`; split note annotation into
  `position`/`technique`/`fingering`; explicit string numbers in tuning; added
  `staffKind`, removed TAB-clef usage; `hammerOnPullOff` split into `hammerOn` /
  `pullOff`; `bend.type` tightened to an enum; single-source encoding.
- **v1** (`guitar-tab-extension.schema.json`, deprecated): flat `_x.guitar` object,
  positional tuning array, TAB clefs carried over from MusicXML.
