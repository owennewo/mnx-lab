# Guitar technique end-to-end (`_x.tab.technique`)

> **Status: data path COMPLETE (2026-07-26); rendering not started.**
>
> The gaps this doc opens with are closed. `harmonic` and `palmMute` now exist
> in the schema and travel through both converters (42 harmonics and 2 palm
> mutes in `Vestapol` that used to be dropped), and **bends are now curves** —
> `points: [{position, alter}]` in semitones — instead of the single interval
> that silently flattened anything more elaborate than a ramp. Slide enum values
> are camelCase (`slideIn` / `slideOut`), matching MNX house style. Design:
> [mnx-cg-proposals.md](mnx-cg-proposals.md) §5; spec:
> [docs/mnx-extensions.md](../../docs/mnx-extensions.md).
>
> **What is left is rendering** — nothing draws any of it. Note that bend-point
> *timing* does not survive MusicXML (it has no way to state when a point in a
> curve falls); the sequence of pitches does.

## The goal

Make playing technique — **hammer-ons, pull-offs, bends, slides, vibrato** —
survive from a source file to the screen. These are not decoration on a guitar
score; they are how the notes are actually produced, and a tab without them is
an instruction to pick every note.

## Current state: the model is the only part that exists

`_x.tab.technique` is defined in [schemas/mnx-tab-extension.schema.json](../../schemas/mnx-tab-extension.schema.json)
(`bend`, `slide`, `hammerOn`, `pullOff`, `vibrato`) and typed in
[src/types/mnx.ts](../../src/types/mnx.ts). Everything else is missing:

| Stage | State |
|---|---|
| Schema + types | ✅ complete |
| MusicXML import | ❌ `<technical>` reads only `<fret>`/`<string>`; the technique branch is still the original TODO |
| MusicXML export | ❌ never written |
| Guitar Pro import/export | ⚠️ **mapped both directions, zero test coverage** — no fixture contains any technique |
| Notation renderer | ❌ nothing drawn |
| Tab renderer | ❌ nothing drawn |

So the one implemented piece (the Guitar Pro mapping) is unverified code, which
is worse than absent code: it looks finished.

## What prompted this

Chasing "where did the hammer-ons go?" for `Sun-did-glide`. They were lost
**before the file reached us**: the Soundslice MusicXML export contains **zero**
`<hammer-on>` / `<pull-off>` elements, despite MusicXML having dedicated markup
for both. What it exports instead is 54 `<slur>` elements, and those are phrase
slurs, not articulations:

| Slurred pair | Count |
|---|---|
| Different strings (phrase slur) | 31 |
| Involves a rest | 28 |
| Same string, ascending (hammer-on shape) | **1** |

The single same-string pair sits inside a 41-note slur group, so it is a phrase
marking that happens to span two frets on one string — not a hammer-on. Nothing
to recover, and **no fixture in the corpus exercises technique at all**.

That is the real blocker: this work cannot be verified against anything we
currently have.

## Scope

1. **MusicXML import** — parse technique into `_x.tab.technique`.
2. **MusicXML export** — write it back, keeping that round trip lossless.
3. **A technique fixture** — the prerequisite for 1, 2 and for giving the Guitar
   Pro mapping its first test.
4. **Rendering** — draw it. Bigger than the rest combined; see below.

### MusicXML mapping

Note the two different parents — `<slide>` and `<glissando>` hang off
`<notations>`, everything else off `<notations><technical>`:

| MusicXML | MNX |
| :--- | :--- |
| `<technical><hammer-on type="start">` | `technique.hammerOn.target` (id of the destination note) |
| `<technical><pull-off type="start">` | `technique.pullOff.target` |
| `<technical><bend><bend-alter>` | `technique.bend.amount` |
| `<technical><bend><pre-bend/>` | `technique.bend.type = 'pre-bend'` |
| `<technical><bend><release/>` | `technique.bend.release = true` |
| `<notations><slide type="start">` | `technique.slide.type = 'shift'` |
| `<notations><glissando>` | `technique.slide.type = 'shift'` (lineType differs) |
| `<ornaments><wavy-line>` / `<vibrato>` | `technique.vibrato` |

**Bend units differ at every hop** and are the easiest thing to get silently
wrong — one whole step is:

| Format | Value |
| :--- | :--- |
| MusicXML `<bend-alter>` | `2` (semitones) |
| MNX `technique.bend.amount` | `1.0` (whole steps) |
| alphaTab `BendPoint.value` | `4` (quarter tones) |

The MusicXML↔MNX conversion is therefore `amount = bendAlter / 2`. The
alphaTab side (`value / 4`) is already implemented in
`converters/guitarpro-mnx/src/export/gp.ts`, and is exactly the sort of thing a
fixture would confirm.

**Targets are id references.** `hammerOn.target` / `pullOff.target` /
`slide.target` point at another note's id, so the importer has to resolve
`type="start"` → `type="stop"` pairs into ids — the same start/stop pairing
problem the volta work hit, and MusicXML is equally inconsistent about `number`
attributes (`Sun-did-glide` omits them on some slurs and not others).

### Fixture: solved — export GPX from Soundslice, not MusicXML

**`server/scores/Vestapol.gpx` is the fixture.** Soundslice can export Guitar
Pro 6 (`.gpx`), and that export carries everything its MusicXML export throws
away. Same piece, same 82 measures, same 732 notes:

| | `Vestapol.xml` | `Vestapol.gpx` |
|---|---|---|
| bends | 0 | **11** |
| hammer-ons / pull-offs | 0 | **42** |
| slides | 0 | **17** |
| harmonics | 0 | **42** |
| palm mute | 0 | **4** |
| staccato | 10 | 5 |
| ties | 152 | 38 |
| String 3 tuning | **F♭3 — wrong** | F♯3 — correct |

That last row matters as much as the technique: the MusicXML export declares
`<tuning-alter>-1</tuning-alter>` on the F string, so 39 notes disagree with
their own tuning by +2 semitones. The GPX has the correct F♯3 and **all 732
notes are consistent**.

**Recommendation: prefer `.gpx` over MusicXML for anything coming out of
Soundslice.** It is strictly more faithful, and `converters/guitarpro-mnx`
already reads it.

#### Status update (2026-07-26): the data path is DONE

The corpus moved to GPX and technique now travels end to end. What was built:

| | |
|---|---|
| Guitar Pro import/export | ✅ verified against real technique for the first time |
| MusicXML import/export | ✅ `<hammer-on>`, `<pull-off>`, `<bend>`, `<slide>` both ways |
| `MNX → .gp → MNX` | ✅ lossless on all three fixtures |
| `MNX → MusicXML → MNX` | ✅ lossless on all three fixtures |
| Rendering | ❌ still nothing drawn — the remaining work |

Bugs this shook out, all found by having real technique to test with:

1. **Every technique target dangled.** `hammerOn.target` is an id *reference*, but
   the Guitar Pro importer assigned no `id` to any note — 42 of 42 targets in
   Vestapol pointed at nothing. Notes now carry ids.
2. **`shift` slides exported as `slide-out`.** The exporter mapped MNX's four
   slide kinds onto `OutUp`/`OutDown` only, turning a slide *between two notes*
   into a slide *off the end*. All four kinds now map correctly, and 9 of
   Vestapol's 17 slides turn out to be `legato`, which was being lost entirely.
3. **MusicXML cannot express legato vs shift** — the convention is that a legato
   slide is slurred (picked once). Now written and read that way.
4. **Capo was dropped by MusicXML in both directions**, silently transposing
   Sun-did-glide down a major third. Now `<staff-details><capo>`.
5. **Key signature was dropped by the Guitar Pro importer** — Vestapol is in A
   major and arrived with no key at all.
6. Part ids compounded on re-export (`P1-std-std`); the split is now idempotent.

#### What that fixture already proved

Running it through the existing converter gave the Guitar Pro technique mapping
its first exercise, and it works:

| alphaTab | → MNX | Result |
|---|---|---|
| hammerPull 42 | `hammerOn` / `pullOff` | 32 / 10, split correctly by pitch direction |
| slideOut 17 | `slide` | 17 |
| bend 11 | `bend` | 11 |

Output is schema-valid, every `_x.tab` block passes the tab schema, and
`MNX → .gp → MNX` preserves all four counts exactly. The bend unit conversion
(`alphaTab value / 4`) is confirmed against real data: values `1` and `4` in the
file become `0.25` (a quarter-tone curl, 10 of them) and `1.0` (a full step, 1)
— musically right for this repertoire.

#### What it does NOT capture (the remaining work)

| In the GPX | Blocked by |
|---|---|
| **harmonics ×42** | **no room in the tab schema** — see open questions |
| palm mute ×4 | no room in the tab schema |
| staccato ×5 | MNX `markings.staccato` exists; the GP importer doesn't map it |
| ties ×38 | MNX `note.ties` exists; the GP importer doesn't map it |

Harmonics being the single most common technique in the file (42, tied with
hammer-ons) turns the schema question below from hypothetical into the first
thing to decide.

### The MusicXML route, for the record

Two independent scores, both authored with technique, both exported by the
"Soundslice MusicXML exporter":

| | `Sun-did-glide.xml` | `Vestapol.xml` |
|---|---|---|
| `<hammer-on>` / `<pull-off>` | 0 | 0 |
| `<bend>` | 0 | 0 |
| `<slide>` / `<glissando>` | 0 | 0 |
| `<harmonic>` | 0 | 0 |
| `<technical>` children | `fret`, `string` only | `fret`, `string` only |

Vestapol was authored with bends and slurs; the MusicXML export contains neither
(it has no `<slur>` at all) — while *its own GPX export of the same score* has
11 bends. So Soundslice's MusicXML exporter simply does not emit guitar
technique; this is not a per-file accident, and no export setting will fix it.

MusicXML technique parsing is therefore still worth building (third-party files
from other editors will carry it), but it is no longer on the critical path, and
it can be tested against a document converted from the GPX rather than against
anything Soundslice writes.

A **third-party `.gp3`/`.gp4`/`.gp5`** would still be valuable separately: every
Guitar Pro test still starts from a file this converter wrote, so the legacy
binary readers remain unexercised.

## Rendering is the expensive half

Import/export is a mapping exercise; drawing is not. Bends in particular need a
curve with an arrow and a pitch label above the tab staff, plus vertical room
that the layout does not currently reserve — closer in cost to the ottava work
than to a note-level glyph. Hammer-on/pull-off slurs and slide lines are more
tractable.

This should probably be **split**: land the data path (1–3) first so documents
stop losing information, then treat rendering as its own item against the
[SPEC_APPROVAL](../complete/SPEC_APPROVAL.md) process. Carrying technique that
nothing draws is still a strict improvement — the `.gp` export becomes correct
for Guitar Pro users immediately, which is the main consumer of this data today.

## Adjacent, deliberately not included

**Phrase slurs.** All 54 in `Sun-did-glide` are dropped by the MusicXML
importer. They are standard MNX (`MnxSlur` on the event, already typed and
rendered by the notation layout) — a different gap in the same `<notations>`
element, worth doing, but not technique.

Also missing from `<technical>` and out of scope here: harmonics, palm mute,
tapping, `let ring`, golpe.

## Open questions

- **`harmonic` and `palmMute` need somewhere to live.** `Vestapol.gpx` has 42
  harmonics — as many as its hammer-ons — and the tab schema has no room for
  either. This would be the first extension to `_x.tab` since v2, so it wants
  deciding before more technique work lands, not after.
- Hammer-on/pull-off direction is derivable from pitch (up = hammer, down =
  pull), so should the importer trust the source's element, or the pitches, when
  they disagree?
- Should the renderer draw technique on the **notation** staff too (slur +
  "H"/"P" letters), or is tab-only correct for now?
