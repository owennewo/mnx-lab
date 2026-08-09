# Tuplets and grace notes across the converters (and on tab)

> **Status: proposed (2026-08-09).** Split out of
> [guitar-pro.md](../complete/guitar-pro.md) when that effort closed. It was the one
> genuine feature gap left there, and it was never Guitar-Pro-specific: **neither**
> converter carries tuplets or grace notes, and the tab renderer draws neither. Filing
> it once, at its real scope, beats leaving the same hole recorded in three places.

## Where the support actually stops

The model and the notation renderer are **not** the gap — this is a converter and
tab-renderer story:

| Layer | Tuplets | Grace notes |
|---|---|---|
| `src/model/mnx.ts` (`MnxTuplet`, `MnxGrace`) | ✅ modelled | ✅ modelled |
| Notation layout (`engine/layout/notation.ts`) | ✅ drawn (`emitTuplet`, pre-scaled plan columns) | ✅ drawn (`GRACE_SCALE`, sits out beams) |
| Spec corpus | ✅ `spec/grace-note`, `spec/grace-notes-beamed`, `spec/beams-inner-grace-notes` | ✅ same |
| Tab layout (`engine/layout/tabStaff.ts`) | ❌ columns reserved, nothing drawn | ❌ columns reserved, nothing drawn |
| `converters/guitarpro-mnx` | ❌ import flattens + `warn()`; export `warn()`s | ❌ both directions `warn()` |
| `converters/musicxml-mnx` | ❌ no handling at all (zero mentions in `src/`) | ❌ no handling at all |

So the notation engine already knows how to engrave both; what's missing is getting
them **in and out of the file formats**, and drawing them on the fingerboard.

Neither behaviour is silent, which is why this is a gap and not a bug: the Guitar Pro
importer flattens a tuplet and says so (`src/import/gp.ts` — "a 3:2 tuplet was
flattened (MNX tuplet containers are not built yet)"), and the exporter warns rather
than dropping. The MusicXML converter doesn't warn because it never looks.

## Why nothing caught it

**None of the three reference fixtures contains a tuplet or a grace note** —
`House-of-the-Rising-Sun`, `Sun-did-glide` and `Vestapol` are all zero for both. The
round trips are honestly lossless *on the material they carry*; they simply never
present the case. Step zero is therefore a fixture, not code.

## The shape of the work

1. **A fixture that contains them.** Author a short `.gpx` with triplets and a grace
   note (an acciaccatura before a chord is the common guitar case), derive `.mnx.json`
   and `.xml` from it the way the corpus rule requires. This is the load-bearing step —
   like `Sun-did-glide`'s non-standard tuning, a converter that fakes it fails loudly
   here.
2. **Guitar Pro, both directions.** Containers in MNX (`MnxTuplet` wraps its inner
   events), per-beat flags in Guitar Pro (`Beat.tupletNumerator`/`tupletDenominator`,
   `Beat.graceType`). Import collapses runs of equally-flagged beats into one
   container; export expands a container back out — the same collapse/expand asymmetry
   already solved for **voltas** (declared once in MNX, flagged per bar in GP), so
   follow that precedent rather than inventing a second one.
3. **MusicXML, both directions.** `<time-modification>` + `<tuplet>` notations, and
   `<grace slash="yes">`. Note the same trap the volta work hit: MusicXML has more than
   one convention in the wild, so accept both on import and write the common form.
4. **Tab rendering.** Grace notes and tremolos are already listed as a recorded
   limitation of the tab staff — the plan reserves their columns so notation and tab
   stay aligned, but `emitTabVoices` draws nothing. Small grace fret digits and a
   tuplet bracket over the tab staff would close it. Extend `tabStaff.ts`, never fork
   it: the standalone tab layout and the `both` view's native staff share that module.
5. **Corpus scenarios** pinning each, once they render.

## Why it is worth doing

Tuplets are not exotic in guitar music — swung eighths, triplet fills and 6/8
subdivisions are ordinary, and a converter that flattens them changes the rhythm of the
music it claims to round-trip losslessly. Grace notes are how a huge amount of guitar
idiom is written down. The current behaviour is honest but lossy, and the loss is
silent to anyone who doesn't read the warnings.

## Not this

Not nested tuplets (Guitar Pro's own model is shallow), and not tremolo — that already
has its own handling in the notation layout and a separate tab gap.
