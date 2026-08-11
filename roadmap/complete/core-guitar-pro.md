# Guitar Pro ⇄ MNX conversion (via alphaTab)

> **Status: COMPLETE (2026-08-09).** `converters/guitarpro-mnx/` is bi-directional,
> alphaTab-backed and **56 tests green** — the corpus is authored as Guitar Pro and
> both directions are pinned. Sibling to the shipped
> [MusicXML converter](../complete/core-musicxml.md); same shape, different source format.
>
> Two things were deliberately scoped **out** rather than left as implied promises,
> both recorded at "What was left, and where it went" below: gp3/gp4/gp5 reader
> coverage (alphaTab's code, not ours) and tuplets/grace notes (never
> Guitar-Pro-specific — split to
> [core-tuplets-grace-notes.md](../proposed/core-tuplets-grace-notes.md)).

## What is built

`converters/guitarpro-mnx/` — bi-directional, alphaTab-backed, **56 tests green**
(47 round-trip + 9 import).

| | Status |
|---|---|
| Import `.gp`/`.gpx`/`.gp3`/`.gp4`/`.gp5` → MNX | ✅ notes, rests, durations+dots, voices, tunings, capo, positions, clefs, key/time, repeats, alternate endings, tempo |
| **Import from a real Guitar Pro binary** | ✅ the three `.gpx` fixtures are BCFS containers authored in the app; importing each **reproduces its committed `.mnx.json` exactly** (`tests/import.test.ts`) |
| Lyrics, both directions | ✅ multi-verse, with hyphenation — see below |
| Repeats + alternate endings, both directions | ✅ incl. play count and multi-bar volta spans — see below |
| Sections, rehearsal marks, tempo | ✅ both directions, incl. non-quarter beat units |
| Chord symbols | ✅ beat text *and* GP `Chord` objects → `harmonies[]`, slash chords, literal spellings preserved |
| Export MNX → `.gp` (GP7) | ✅ verified as a real GP7 zip container (`VERSION` 7.0 + `Content/score.gpif`) |
| `MNX → .gp → MNX` round trip | ✅ **byte-for-byte identical events** on all three reference scores |
| `_x.mnxLab.tab.technique` | ✅ **exercised** — Vestapol carries hammer-ons, pull-offs, slides, vibrato, harmonics and palm mute; bends round-trip as **curves** (`points: [{position, alter}]`, semitones ← GP's quarter tones) |
| Tuplets, grace notes | ➡️ **out of scope here** — both directions `warn()` rather than silently dropping; the feature moved to [core-tuplets-grace-notes.md](../proposed/core-tuplets-grace-notes.md) |

**Round-trip results** (`MNX → .gp → MNX`, comparing measure, voice, sounding
pitch, duration base, dots, string and fret for every event):

| Fixture | Measures | Events | Differences |
|---|---|---|---|
| `House-of-the-Rising-Sun.mnx.json` | 49 → 49 | 393 → 393 | **0** |
| `Sun-did-glide.mnx.json` | 77 → 77 | 839 → 839 | **0** |

Both outputs validate against `schemas/mnx-schema.json` *and*
`schemas/mnx-tab-extension.schema.json`. `Sun-did-glide` is the load-bearing
fixture: its **non-standard tuning** (E4 **A3** G3 D3 A2 E2) would let a
string-numbering bug pass unnoticed under standard tuning.

### Findings worth keeping

1. **String numbering is inverted.** MNX `_x.tab.position.string` counts 1 =
   *highest* string; alphaTab/Guitar Pro counts 1 = *lowest*. Verified
   empirically — with `tunings = [64,59,55,50,45,40]`, `string=1, fret=0` reports
   `realValue = 40` (E2). The tuning *array* order (high→low) does agree with MNX
   entries sorted by string number. Isolated in `src/common/tuning.ts`.
2. **alphaTab does not pad unused voices.** A defensive "skip all-rest voices"
   filter deleted two real voices from `Sun-did-glide` measures 76–77. Only skip
   voices with zero beats.
3. **The MIDI program decides the instrument.** Guitar Pro derives the track
   name, staff line count and playback sound from it; left unset (0) a guitar tab
   opens as *Acoustic Piano*. Now defaults to GM 25, Acoustic Guitar (steel).
4. **Guitar Pro encodes lyrics as one text blob per verse**, re-split on
   whitespace, with a trailing `-` marking a syllable that continues into the
   next (`shin-` + `ing`) and `+` escaping a space *inside* a syllable. That maps
   exactly onto MNX's `type: 'start' | 'middle' | 'end' | 'whole'`, so
   hyphenation survives. GP7 additionally writes a per-beat `<Lyrics>` element,
   which is why **attachment survives too** — worth knowing, because alphaTab's
   *legacy* `applyLyrics` path (gp3–gp5) re-dispatches a verse onto **voice 0,
   skipping rests**, so importing an old binary file will not preserve which
   event a syllable belongs to.

5. **A string can only be fretted once, and consumers disagree about it.** When
   the same string+fret appears in two voices at one instant — standard
   fingerstyle engraving for a note shared between a bass line and the melody —
   **Ultimate Guitar silently re-frets the duplicate onto another string**,
   producing a note nobody plays; TuxGuitar draws both in the same place.
   Observed directly in `Sun-did-glide` bar 6: an open high E (string 1) written
   in both voices reappeared in UG as **fret 7 on the A string** — and since
   that tuning's 2nd string is A3, 57 + 7 = 64 = E4 exactly, proving UG read our
   tuning and re-fingered rather than misread anything. The `.gp` we wrote
   contained no fret 7 at all.

   Handled in three places, deliberately not one:
   - **Export** collapses exact unisons by default (`collapseTabUnisons`),
     keeping the copy that stands alone in its event over one that is a chord
     member — dropping the melody's copy would leave a hole in the melodic line.
     Genuine conflicts (different frets, one string) are never collapsed.
   - **`src/layout/validate.ts`** reports them: `warning` for a shared note,
     `error` for different frets on one string, both `scope: 'tab'`.
   - **MusicXML import stays lossless** — the duplicate is meaningful notation,
     and deduping there would break the verified 839/839 round trip.

6. **Voltas are declared once in MNX but per-bar in Guitar Pro.** MNX puts one
   `ending` on the bar a bracket opens, spanning `duration`. Guitar Pro flags
   *every* bar of the span with the same mask — alphaTab draws the open hook
   where a bar's mask differs from the previous bar's and closes it where it
   differs from the next, so flagging only the first bar renders a **one-bar
   bracket**. Export expands the span, import collapses runs back, and the
   round trip is exact. MusicXML has no single convention either: the common
   form marks `start` on the first bar and `stop` on the last, while Soundslice
   marks `start`+`stop` on *every* bar (44 marks for one 22-bar volta). The
   importer accepts both; the exporter writes the common form.

### Lyric round trip (`Sun-did-glide`, 3 verses, 163 syllables)

| | verse 1 | verse 2 | verse 3 |
|---|---|---|---|
| syllables | 54 | 54 | 55 |
| words | identical | identical | identical |
| attachment (measure / voice / rest-vs-note) | identical | identical | identical |
| syllable type | 5 normalised | 6 normalised | 4 normalised |

The "normalised" types are all the same case: the **source** marks a syllable
`begin` and the next one `single` (e.g. `shin` = begin, `ing` = single), which is
self-inconsistent MusicXML. The dash encoding forces the correct answer on the
way back, so those come home as `end`. The round trip is more correct than its
input.

## What was left, and where it went

The original list, resolved item by item — three closed, two scoped out.

- ✔ **Technique fixtures.** Closed by the **Vestapol** fixture: hammer-ons, pull-offs,
  slides, vibrato, harmonics and palm mute all survive `MNX ⇄ .gp`, and bends became
  *curves* rather than a single interval that flattened anything more elaborate. This
  converter is still the only one that populates `_x.mnxLab.tab.technique`.

- ✔ **Import-side fixtures** (2026-08-09). The gap was subtler than "we need a file
  from the wild": all 47 round-trip tests started from `.mnx.json`, so nothing
  exercised the thing a user does *first* — open a file Guitar Pro wrote. The fixtures
  were already the right evidence and nobody had pointed a test at them. They are
  **BCFS containers** (GP6's proprietary binary, authored in the app), and per the
  corpus rule the `.mnx.json` is *derived from them*. `tests/import.test.ts` now
  asserts that derivation byte for byte on all three, plus the container magic (so the
  suite can't quietly start proving something about our own exporter's output) and a
  fingerboard sanity check. An importer change can no longer silently invalidate every
  committed fixture — and transitively the `.xml` derived from them.

- ➡️ **gp3/gp4/gp5 reader coverage — out of scope, deliberately.** Those are
  **alphaTab's** binary readers; our mapper consumes an alphaTab `Score` and cannot
  tell which reader produced it. A third-party `.gp4` would test alphaTab's parsing,
  not our mapping, and the project already took the position that not writing byte
  readers is the whole reason alphaTab is a dependency. The one legacy-format concern
  that *is* ours is documented and unchanged: finding 4 below — alphaTab's gp3–gp5
  `applyLyrics` path re-dispatches a verse onto voice 0, skipping rests, so **lyric
  attachment does not survive an old binary import**. That is a known limitation with a
  named cause, not a missing test.

- ➡️ **Tuplets and grace notes — moved, not dropped.** Never Guitar-Pro-specific:
  *neither* converter handles them (MusicXML doesn't even look) and the tab renderer
  draws neither, while the model and the notation renderer support both. Recording the
  same hole in three places was the actual problem. Now
  [core-tuplets-grace-notes.md](../proposed/core-tuplets-grace-notes.md), at its real scope, with
  the fixture as step zero — no reference score contains a tuplet or a grace note, which
  is why the round trips are honestly lossless and still never present the case.

- ⚠️ **Manual acceptance — a recorded caveat, not a blocker.** Downgraded on evidence.
  What it aimed to prove was that a real consumer accepts our output; three things
  narrow that: the `.gp` is written by alphaTab's own `Gp7Exporter` (container
  conformance is alphaTab's contract, not ours — our file declares GPIF 8.1.3), alphaTab
  re-reads our output losslessly in every round-trip test, and **acceptance testing has
  already happened once against a real consumer** — finding 5 below (Ultimate Guitar
  silently re-fretting a duplicated string) was discovered by uploading a generated
  file, which is also why the export now collapses unisons. Ultimate Guitar is a
  **browser upload**, so a fresh acceptance pass never needed the desktop app. What
  remains unproven is only the Guitar Pro *application's* own reader, and no test in
  this repo could ever have covered that.

- Wiring into the app (drag-and-drop import) — **explicitly not this**; see the
  bundle-size caveat below (alphaTab unpacks to ~13.7 MB).

## The goal

Read and write the **Guitar Pro** family — the de-facto interchange format for guitar tab, and
what Ultimate Guitar's interactive tabs are authored in — with **MNX remaining the core
format**. Guitar Pro is an import/export skin, never an internal representation:

```
.gp / .gpx / .gp5 / .gp4 / .gp3  ──import──▶  MNX (+ _x.tab)  ──export──▶  .gp
```

This is the single highest-leverage format to add. MusicXML is the *lingua franca* but is a
poor carrier of guitar idiom (this project already has to smuggle frets/strings through
`<technical>` and tuning through `<staff-details>`). Guitar Pro is **natively** a tab format:
strings, frets, tunings, capo, bends, slides, hammer-ons/pull-offs, harmonics and palm-muting
are first-class fields, not annotations. It maps onto `_x.tab` far more directly than
MusicXML does.

## Why alphaTab, and what it removes from scope

[alphaTab](https://alphatab.net) (`@coderline/alphatab`, **v1.8.4**, **MPL-2.0**,
**zero runtime dependencies**) does the part we should not write ourselves. Both load-bearing
capabilities are confirmed against its docs:

- **Headless import, no rendering** — [`ScoreLoader.loadScoreFromBytes(data, settings)`](https://alphatab.net/docs/guides/lowlevel-apis/)
  takes a raw `Uint8Array` and returns a `Score` object. No canvas, no DOM, no player.
  ```js
  const data = new Uint8Array(fs.readFileSync('tab.gp'));
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(data, new alphaTab.Settings());
  ```
- **Export** — [`Gp7Exporter`](https://alphatab.net/docs/guides/exporter) (since alphaTab 1.2)
  writes Guitar Pro 7+ `.gp` binaries.
  ```js
  const bytes = new alphaTab.exporter.Gp7Exporter().export(score, settings);
  ```
- **Format coverage on import** — [gp3/gp4/gp5](https://alphatab.net/docs/formats/guitar-pro-3-5)
  (proprietary binary), [gpx](https://alphatab.net/docs/formats/guitar-pro-6) (GP6, zip+XML),
  `.gp` (GP7+, zip+XML), plus MusicXML and Capella.

**What this means for effort:** we never touch a byte reader. gp3–gp5 are undocumented
little-endian binaries with bit-packed beat/note headers; gpx/gp are zip-wrapped XML with a
completely different structure. Hand-rolling even *one* of those is 500–800 lines plus the
usual binary-format debugging tax, times five for the family. alphaTab has already absorbed
that cost and keeps up with new Guitar Pro releases.

So the work reduces to a **model↔model mapper**: alphaTab's `Score` tree ⇄ `MnxStructure`.
alphaTab's object model *is* our intermediate representation. This is a much smaller and much
better-conditioned problem than the MusicXML importer faced — see below.

### The one asymmetry to accept

**Import covers gp3 → gp8; export writes `.gp` (GP7+) only.** No GP4/GP5 *writer* exists in
alphaTab (or, realistically, anywhere maintained). This is fine in practice: Guitar Pro 7/8
opens `.gp`, and it is the current-generation format. "Export to .gp4" should be declared
**out of scope**, not left as an implied promise.

## Why the mapping is easier than MusicXML's

The MusicXML importer's 538-line [`aligner.ts`](../../converters/musicxml-mnx/src/import/aligner.ts)
is large almost entirely because MusicXML *destroys* structure that MNX needs back:

| Problem in MusicXML → MNX | Status in Guitar Pro → MNX |
| :--- | :--- |
| Flat `<note>` stream with `<backup>`/`<forward>`; voices must be reconstructed by tracking a time cursor | **Gone.** alphaTab gives `Bar.voices[]` already separated. |
| Notation part `P1` and TAB part `P2` are separate; must be aligned onset-by-onset and merged (`mergeParts`/`alignNoteIds`) | **Gone.** GP is single-source by nature — one note carries pitch *and* string/fret. Emit `staffKind: 'both'` directly. |
| Written-vs-sounding octave transposition must be undone before alignment can succeed | **Gone.** GP stores string+fret against a tuning; sounding pitch is derived, never ambiguous. |
| Frets/strings smuggled through `<notations><technical>` | Native `Note.string` / `Note.fret`. |
| Tuning smuggled through `<staff-details><staff-tuning>` | Native `Track.staves[].tuning`. |
| Bends/slides/hammer-ons **not parsed at all** (TODO at `aligner.ts:312`) | Native, richly modeled — this converter would be the **first to populate `_x.tab.technique`**. |

The structural correspondence is near 1:1:

| alphaTab | MNX |
| :--- | :--- |
| `Score` (title, artist, tempo) | root + `global` |
| `Score.masterBars[]` (time sig, key, repeats, alternate endings, tempo) | `global.measures[]` |
| `Track` | `parts[]` entry |
| `Track.staves[].tuning`, `capo` | `part._x.tab.tuning[]`, `part._x.tab.capo` |
| `Bar` | `part.measures[]` entry |
| `Bar.voices[]` | `measure.sequences[]` (`voice: 'v1'…`) |
| `Voice.beats[]` | `sequence.content[]` (`MnxEvent`) |
| `Beat.duration` + `dots` + tuplet | `event.duration.{base,dots}` / `MnxTuplet` |
| `Beat.notes[]` | `event.notes[]` |
| `Note.string` / `Note.fret` | `note._x.tab.position.{string,fret}` |
| `Note.bendPoints`, `slideIn/Out`, `isHammerPullOrigin`, `vibrato` | `note._x.tab.technique.{bend,slide,hammerOn,pullOff,vibrato}` |
| `Note.realValue` (sounding pitch) | `note.pitch.{step,octave,alter}` |
| `Beat.lyrics` | `event.lyrics` |

Two mapping details worth pinning down early:

1. **String numbering.** alphaTab (following Guitar Pro) numbers strings from the *highest*
   string as 1 — which already matches `_x.mnxLab.tab`'s convention ([docs/mnx-extensions.md](../../docs/mnx-extensions.md)).
   Verify rather than assume; the MusicXML importer has to invert `<staff-tuning line="N">`
   (line 1 = lowest) and getting this backwards is silent and ugly.
2. **Pitch spelling.** GP stores string+fret and derives a MIDI number; it has no
   step/octave/alter spelling. Deriving MNX pitch means choosing enharmonics from the key
   signature — the one place this converter does *more* work than the MusicXML one.

## Reference fixture: `Sun-did-glide`

> **Historical from here down** — the sections below are the original plan, kept for
> provenance, and their paths and field names predate the 2026-07 rebuild
> (`server/scores/` → `converters/fixtures/`, `_x.tab.position.string` → flat
> `_x.mnxLab.string`, `src/types/mnx.ts` → `src/model/mnx.ts`). What actually happened:
> the fixture direction **inverted**. The plan below treats MusicXML as the source and
> derives Guitar Pro from it; the corpus now does the opposite — `.gpx` is **authored**
> in Guitar Pro and both `.mnx.json` and `.xml` are derived from it, which is what makes
> `tests/import.test.ts` meaningful. A third fixture, **Vestapol**, joined to carry
> technique.

Use [server/scores/Sun-did-glide.xml](../../server/scores/Sun-did-glide.xml) as the
round-trip fixture, mirroring how `House-of-the-Rising-Sun.xml` anchors the MusicXML
converter's tests. It is currently **MusicXML-only and untracked in git** — committing it is
step zero.

What it exercises (Soundslice export, MusicXML 4.0, 77 measures × 2 parts):

- **Non-standard tuning** — E4 A3 G3 D3 A2 E2 (high→low; 2nd string A3, not B3). Excellent
  tuning round-trip pressure; a converter that hardcodes standard tuning fails loudly here.
- **Two-part notation + TAB** — `P1` treble with `<transpose>-12`, `P2` TAB with 6-line
  `<staff-details>`. Exercises the merge-to-single-source path.
- **505 fret/string pairs** across 1,678 notes.
- **Repeat structure** — 4 `<repeat>`, 88 `<ending>` (voltas), 96 barlines. These land in
  `global.measures[].{repeatStart,repeatEnd,ending}`, all of which MNX models natively.
- **346 lyric syllables** with `<syllabic>` — maps to `event.lyrics`.
- **54 slurs, 52 beams, 178 accidentals, 230 alters.**
- **4 `<arpeggiate>`** — ⚠️ **a real gap.** `MnxEventMarkings` ([src/types/mnx.ts:72](../../src/types/mnx.ts#L72))
  has no arpeggio; `'arpeggio'` exists only as a tie `targetType`. GP models strums/brushes
  natively, so this will need an `_x` extension or a decision to drop it.
- **No bends/slides/hammer-ons** — so this fixture proves *structure*, not technique. A second
  fixture with heavy technique content is needed to exercise `_x.tab.technique`.
- **No `<work-title>`/`<creator>`** — metadata is encoding-only.

### Test plan

The fixture gives a genuinely strong test because two independent converters can be crossed
against each other:

1. `Sun-did-glide.xml` ──(existing MusicXML importer)──▶ **golden MNX**, committed.
2. golden MNX ──(new exporter)──▶ `.gp` ──(new importer)──▶ MNX′.
3. Assert MNX′ ≡ golden on the load-bearing fields: tuning, every `position.{string,fret}`,
   pitches, durations, voices, repeats/endings, lyrics.
4. Independently: open the generated `.gp` in Guitar Pro / upload to Ultimate Guitar as a
   manual smoke test — the format is only useful if real consumers accept it.

Divergences found in step 3 are the actual specification of "what's lossy," rather than
guesses made up front.

## Proposed package

A sibling to the MusicXML converter, cloning its layout (standalone package, own `tsconfig`,
own `vitest`, own CLI bin — **not** wired into the app build):

```
converters/guitarpro-mnx/
├── src/
│   ├── import/
│   │   ├── guitarpro.ts    # loadScoreFromBytes → orchestration
│   │   └── mapper.ts       # alphaTab Score tree → MnxStructure
│   ├── export/
│   │   └── mnx.ts          # MnxStructure → alphaTab Score → Gp7Exporter
│   ├── common/
│   │   ├── types.ts        # (prefer importing src/types/mnx.ts — see below)
│   │   └── utils.ts        # duration/tuning/pitch-spelling helpers
│   ├── cli.ts              # guitarpro-mnx --import in.gp --output out.json
│   └── index.ts
├── tests/
│   ├── import.test.ts
│   └── roundtrip.test.ts
└── package.json            # dep: @coderline/alphatab
```

**Do not repeat the types mistake.** `converters/musicxml-mnx/src/common/types.ts` is a
hand-maintained *trimmed copy* of the app's MNX types — it has no tuplets, grace notes, beams,
ties or slurs, all of which Guitar Pro produces routinely. This converter should target the
canonical [src/types/mnx.ts](../../src/types/mnx.ts) directly (or the two copies should be
reconciled first).

## Effort

Given alphaTab absorbs all binary/zip parsing:

| Scope | Estimate |
| :--- | :--- |
| Import `.gp`/`.gpx`/`.gp3-5` → MNX: notes, tunings, frets, durations, voices, repeats, lyrics | ~3–4 days |
| `_x.mnxLab.tab.technique` mapping (bends, slides, HO/PO, vibrato, harmonics, palm mute) | +2 days |
| Export MNX → `.gp` via `Gp7Exporter` | ~2–3 days |
| Round-trip test harness + fixture wiring | ~1 day |

Call it **~1.5–2 weeks** for a solid bi-directional converter — versus roughly double that if
the binary formats were parsed by hand, for a strictly worse result (gp4 only, and stale the
moment Arobas ships a new format).

## Risks & open questions

- **Bundle size.** alphaTab unpacks to ~13.7 MB (it carries fonts, a renderer and a synth we
  don't want). Harmless inside a standalone Node CLI sub-package; it would be **unacceptable
  in the app bundle**. Keep the converter out of `src/` — or, if in-browser `.gp` drag-and-drop
  is ever wanted, that needs a separate tree-shaking/lazy-chunk investigation first.
- **Licence.** MPL-2.0 is file-level copyleft: fine for consuming as a dependency, but any
  *modified alphaTab source* we vendor must stay MPL. Don't fork it into our tree.
- **Renderer gaps become visible.** Guitar Pro scores routinely carry things the renderer
  does not draw yet (bends, slides, palm mute, rhythm slashes, arpeggio/strum). Imported
  documents will surface amber "renderer gap" diagnostic badges. That is correct behaviour —
  but it means importing GP files will grow the deferred-polish backlog in
  [lab-spec-approval.md](../complete/lab-spec-approval.md). Worth deciding whether GP imports enter
  the scenario corpus as `lab/` scenarios.
- **Arpeggio has nowhere to go** (see fixture notes) — needs an `_x` extension or an explicit
  drop.
- **Pitch spelling on import** — enharmonic choice from key signature; needs a rule and a test.
- **Is this a standards-gap contribution?** The tab-extension work already feeds
  [w3c-cg/mnx#63](https://github.com/w3c/mnx/issues/63). A GP converter is strong evidence for
  *what a real tab format actually needs to carry* — technique data especially — and could be
  written up as input to that proposal.

## Not this

Not in-browser `.gp` upload, not a Guitar Pro renderer, not alphaTab's player/synth (the
project has Tone.js), and **not** alphaTab as a rendering or intermediate layer anywhere in
the app. CLAUDE.md's "no third-party notation libraries" rule stands — alphaTab is a
**file-format codec confined to a standalone converter package**, exactly as `@xmldom/xmldom`
is for MusicXML.
