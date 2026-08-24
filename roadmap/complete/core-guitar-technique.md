# Guitar technique end-to-end (`_x.mnxLab.tab.technique`)

> **Status: COMPLETE (2026-08-24).** Data path landed 2026-07-26; **rendering landed
> 2026-08-24** — every technique is drawn, on **both** staves. Verification debt:
> [lab-verify.md](../inprogress/lab-verify.md) batch 4.
>
> The gaps this doc opened with are all closed. `harmonic` and `palmMute` exist in the
> schema and travel through both converters (42 harmonics and 2 palm mutes in `Vestapol`
> that used to be dropped), **bends are curves** — `points: [{position, alter}]` in
> semitones — instead of the single interval that silently flattened anything more
> elaborate than a ramp, and since this item nothing carries technique that nothing
> draws. Design: [spec-mnx-cg-proposals.md](../proposed/low-priority/spec-mnx-cg-proposals.md)
> §5; spec: [docs/mnx-extensions.md](../../docs/mnx-extensions.md); entry half:
> [core-element-ops-technique.md](core-element-ops-technique.md).
>
> Bend-point *timing* still does not survive MusicXML (it has no way to state when a
> point in a curve falls); the sequence of pitches does.
>
> **Historical note.** Everything below the fold is the doc as it stood while the work
> was open, paths and all — it opens by describing a `schemas/mnx-tab-extension.schema.json`
> and a `src/types/mnx.ts` that the 2026-07 rebuild renamed. It is left as written; the
> record of what was believed at the time is the point of `complete/`.

## What the rendering half actually did (2026-08-24)

`src/engine/layout/technique.ts` draws all seven techniques. It is the drawing half this
doc split off at *Rendering is the expensive half*, and the estimate there held: it cost
more than the data path did.

| Technique | Tab staff | Notation staff |
|---|---|---|
| `bend` | curve off the fret digit to a labelled arrowhead; pre-bend is a vertical arrow, release a downward head | the same gesture in the lane above — no string to watch it climb |
| `slide` (`shift`/`legato`) | the line between the two digits, **slanted** | the line between the two noteheads |
| `slide` (`slideIn`/`slideOut`) | the short approach or departure, on the pitch's side | same |
| `hammerOn` / `pullOff` | slur in the lane, lettered "H"/"P" | slur on the side away from the stem, letter above the staff |
| `vibrato` | `guitarVibratoStroke` run across the note's duration | same |
| `palmMute` | "P.M." once per run, over a dashed line | same |
| `harmonic` | the digit becomes `<12>` | `stringsHarmonic` circle over the note; a non-natural type adds its word |

### Four decisions worth keeping

**1. Both staves — and the model decided it, not taste.** The doc's last open question was
whether to draw on the notation staff at all. The answer is in the block's own schema
description: `technique` is drafted for standard MNX, not for tab. None of the seven
requires a position and none is specific to a fretted instrument, so a document that
declares no strings has no fingerboard, no tab staff (no instrument is ever assumed —
[core-derived-positions.md](core-derived-positions.md)), and would have had its technique
go **unrenderable** rather than merely unfretted. `technique.test.ts` pins exactly that
document.

**2. A post-pass, for the reason slurs and ties are one.** `hammerOn`, `pullOff` and
`slide` name their destination by NOTE ID, and that note may be measures — or a system
row — away. So each layout records a `TechniqueSite` per drawn note while it emits, when
it still knows where the ink went, and the marks are drawn once the segment's geometry is
known. Curves whose ends straddle a system break split at the break, the same way
`emitSlursAndTies` splits them.

**3. Nothing reserves vertical room, and nothing needed to.** A bend arrow reaches 1.8sp
above the tab staff, which in the `both` view is the gap to the notation staff overhead.
No constant was added: gaps between staves and between systems have been **ink-measured**
since [core-ink-measured-gaps.md](core-ink-measured-gaps.md), so the system opens by itself
and closes again when the bend is deleted. That is the clearest return that item has paid
— it made room for content it had never seen.

**4. Two engraving rules the first pass got wrong, both caught by looking at a picture
rather than at a test.**

- **A slide along one string must be slanted.** Two frets on one string sit at the same y,
  so a line drawn flat between them lands exactly on the string line already there and
  disappears. Every slide in the corpus — and 17 of 17 in `Vestapol` — is that case, and
  the primitives were all present and correct while the page showed nothing.
- **A notation-staff technique slur takes the side away from the stem**, exactly as an
  ordinary slur does, and its letter stays above the staff. Drawn always-above, every stem
  it spanned crossed it.

Both are now assertions in `harness/conformance/technique.test.ts`, which is the file that
exists because the failure this whole item was about — technique carried and not drawn —
**looks like a clean render**. Every test there is of the form "this technique reaches the
page".

### What it did NOT solve

- **A harmonic's `<12>` is wider than the column reserved for a fret.** `CORE_SP` is 1.5sp
  for every notehead and fret digit; a bracketed two-digit fret draws about 3sp of ink.
  Nothing collides in the corpus, and two-digit frets already overrun the same column, so
  this was left where it was found rather than made a spacing change. Denser music is
  where it would show.
- **Marks above the staff are placed in fixed bands, not stacked.** A note carrying both a
  bend and a palm mute would put the "P.M." near the bend's label. No corpus scenario does
  it, and a real stacker is the ottava-bracket problem again.
- **`slideIn`/`slideOut` and the non-natural harmonic types have no scenario.** They are
  covered synthetically in `technique.test.ts` instead, and deliberately left unclaimed in
  the element-ops ink census — a claim there is a statement about the *goldens*.
- **Phrase slurs are still dropped by the MusicXML importer** (54 in `Sun-did-glide`), as
  recorded under *Adjacent, deliberately not included* below. Unchanged by this item.

---

## The goal

Make playing technique — **hammer-ons, pull-offs, bends, slides, vibrato** —
survive from a source file to the screen. These are not decoration on a guitar
score; they are how the notes are actually produced, and a tab without them is
an instruction to pick every note.

## Current state: the model is the only part that exists

`_x.tab.technique` is defined in `schemas/mnx-tab-extension.schema.json`
(`bend`, `slide`, `hammerOn`, `pullOff`, `vibrato`) and typed in
`src/types/mnx.ts`. Everything else is missing:

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
[lab-spec-approval.md](lab-spec-approval.md) process. Carrying technique that
nothing draws is still a strict improvement — the `.gp` export becomes correct
for Guitar Pro users immediately, which is the main consumer of this data today.

> **Outcome.** Split, and the split was right — but the second half sat for a month, and
> the cost of that is the thing to remember: the corpus grew five scenarios whose own
> descriptions ended "the renderer does not draw this yet", and their goldens dutifully
> pinned a page with nothing on it. A golden pins what we draw; it cannot notice what we
> do not. Both halves are now landed, and the estimate above held — the rendering half
> cost more than the data path, and the expensive part was the drawing, exactly as
> predicted.

## Adjacent, deliberately not included

**Phrase slurs.** All 54 in `Sun-did-glide` are dropped by the MusicXML
importer. They are standard MNX (`MnxSlur` on the event, already typed and
rendered by the notation layout) — a different gap in the same `<notations>`
element, worth doing, but not technique.

Also missing from `<technical>` and out of scope here: harmonics, palm mute,
tapping, `let ring`, golpe.

## Open questions — all three answered

- ~~**`harmonic` and `palmMute` need somewhere to live.**~~ **Answered 2026-07-26 by
  the data path**: both are members of `technique` in
  `spec/mnx-lab-extensions.schema.json` v5, a harmonic identified by TOUCHING PITCH
  rather than touching fret (which covers fretless instruments and the between-fret
  nodes w3c-cg/mnx#179 is about, as a fret integer cannot). All 42 of `Vestapol`'s
  harmonics and both its palm mutes now survive the round trip, and since 2026-08-24
  they are drawn.
- ~~Hammer-on/pull-off direction, source element vs pitches.~~ **Answered by the entry
  side**, [core-element-ops-technique.md](core-element-ops-technique.md): the music
  picks. `H` is one key for both techniques because you hammer *up* and pull off
  downward, so the interval decides which one is written — offering two keys would ask
  the player to name something their fingers already had. The Guitar Pro importer splits
  its single `hammerPull` flag the same way (32 hammer-ons / 10 pull-offs in `Vestapol`).
  Where a source states one explicitly and its pitches say the other, we still trust the
  source: no file has yet been found that disagrees with itself, so the conflict is
  hypothetical and inventing a policy for it would be inventing the evidence too.
- ~~Should the renderer draw technique on the **notation** staff too?~~ **Answered
  2026-08-24: yes, both staves** — see decision 1 above. The reason is not symmetry, it
  is that a strings-less document has no tab staff to carry it.
