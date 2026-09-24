# MusicXML 01a–01h pitch and accidental assessment

**Implementation loop. Agent assessment, application `a8834060`, 2026-09-24.** Eight unchanged originals from
the pinned 183-fixture W3C/LilyPond suite were opened through current Workbench and
Studio. This is a bounded continuation of [render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md)
and [write item 19](../roadmap/inprogress/core-musicxml-write-assessment.md), not
human scenario verification or a whole-suite verdict. Both items remain in progress.

## Evidence and method

- [Feature, view, task and save-route verdicts](../harness/reports/musicxml-pitch-assessment.json)
  carry 11 shared feature IDs, 22 feature × shell × view rows, 88 feature × shell ×
  create/inspect/change/remove rows, and 55 persistence rows. Every source note has a
  stable variant ID (`<fixture>/mNN/nNN`) in the
  [source → imported MNX inventory](../harness/reports/musicxml-pitch-source-import.json).
- [Retained browser evidence](../harness/fixtures/musicxml-pitch-evidence/manifest.json)
  contains both shells' imported MNX, observations, complete notation SVGs and
  overlapping scroll tiles. [Real editor traces](../harness/fixtures/musicxml-pitch-evidence/write/)
  include structural states, exact undo/redo checks, inspector screenshots, Studio GP
  reloads and Library downloads opened in Workbench.
- The original filenames, hashes, MusicXML versions and full descriptions are in the
  [suite manifest](../converters/fixtures/musicxml-suite/manifest.json). The sources
  themselves were not changed. The syntax interpretation uses the official
  [MusicXML accidental element](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/accidental/)
  and [accidental values](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/accidental-value/).

Chrome 153 ran at 1440×1000, device scale 1, staff scale 1 and spacing density 2.
Time signatures were explicitly set to **Show**; each observation records the effective
display options. The capture script tiled the actual Workbench or Studio scroll host
and waited for the rendered projection to settle. All eight sources declare **no
strings**, and both shells offered only Notation. Tab and Both therefore have no
verdict for these fixtures. All eight Studio originals became current through
**Saved → Versions → View → Make current → Library title** and had a nonsuspended
desktop editor. Studio's original XML rendition remained byte-identical; there is no
direct local MusicXML upload control in Studio.

Reproduce after `npm ci` and `npm run build` in an isolated worktree:

```sh
MUSICXML_CAPTURE_FILTER='^01[a-h]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-pitch-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^01[a-h]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-pitch-studio node harness/verify/musicxml-editor-capture.mjs
PITCH_WRITE_FIXTURE=01a-Pitches-Pitches PITCH_WRITE_SHELL=workbench node harness/verify/musicxml-pitch-write-probe.mjs
PITCH_WRITE_FIXTURE=01e-Pitches-ParenthesizedAccidentals PITCH_WRITE_SHELL=workbench node harness/verify/musicxml-pitch-write-probe.mjs
PITCH_WRITE_FIXTURE=01a-Pitches-Pitches PITCH_WRITE_SHELL=studio node harness/verify/musicxml-pitch-write-probe.mjs
PITCH_WRITE_FIXTURE=01e-Pitches-ParenthesizedAccidentals PITCH_WRITE_SHELL=studio node harness/verify/musicxml-pitch-write-probe.mjs
python3 harness/verify/musicxml-pitch-source-audit.py
python3 harness/verify/musicxml-pitch-verdicts.py
```

The capture commands write to `/tmp`; the retained subset is committed. The Studio
probes use a private local library. No production library, scenario status,
verification record or golden is changed by the assessment.

## Source, MNX and visible result

The two shell imports agree byte-for-byte for each fixture. Of **257** source notes,
**237** keep their exact step, octave and alteration; the other **20** are the eight
fractional pitches in `01d` and twelve in `01f`. Note counts remain intact before
Studio storage. A matching pitch table is only one part of the judgment: a named
accidental can be lost while its source pitch remains G4.

| Feature ID / source variants | Current Notation result in both shells | Verdict and cause |
|---|---|---|
| `01a.pitch-sequence` — 108 notes in 27 measures, G2–C7 | All written pitches and extreme ledger positions appear through the full scroll | **Correct** for pitch sequence; bar-27 qualifications are separate |
| `01a.explicit-accidentals` — 76 sharp, flat, natural and double symbols | Imported `accidentalDisplay.show` and pitches retain the ordinary spelling; bars 25–27 visible | **Correct** for ordinary symbols only |
| `01a.accidental-qualifiers` — bar 27 cautionary and editorial sharps | Both become identical `show: true`; no source distinction survives | **Unresolved visually**, definite importer data loss. MusicXML leaves default enclosure styling to applications |
| `01b.interval-ladder` — 41 pairs / 82 notes | All endpoint pitches and interval order retained and visible, including distant ledgers | **Correct**. Its incompatible `common` symbol on 2/4 is warned; meter is outside this feature |
| `01c.omitted-voice` — one G4 has no `<voice>` | Internal `v1` is assigned; absence of a source tag has no separate glyph | **Not applicable** as a render feature |
| `01c.lyric-anchor` — lyric A on the G4 whole note | Event lyric line 1 retains A; both shells show it under the note | **Correct** |
| `01d.fractional-pitches` — four alterations in two registers | Eight fractional values become integers with eight source-located warnings and ordinary glyphs | **Incorrect**: importer + published MNX integer-only pitch; diagnostic and deferral already belong to item 22 |
| `01e.accidental-qualifiers` — 16 notes across cautionary, editorial, parenthesis and bracket cases | Two plain controls look right; six explicitly enclosed values lose their enclosure; eight default-styled flags cannot get a precise visual judgment from source alone | **Partial**: importer loses flags/enclosures; independent UI probe shows the engine ignores even an authored MNX parenthesis |
| `01f.microtonal-accidental-qualifiers` — 16 notes | Twelve fractional pitches wrong; all special names and qualifications collapse to `show: true`. One plain sharp is correct; three ordinary-sharp qualified cases have unresolved default styling | **Incorrect**: importer + representation; the fractional-pitch subset overlaps item 22 |
| `01g.arrow-accidental-glyphs` — 12 distinct names | Twelve identical unaltered G4 notes with ordinary natural signs; no glyph-loss warning | **Incorrect**: importer + no named-glyph carrier |
| `01h.turkish-persian-accidental-glyphs` — 14 distinct names | Fourteen identical unaltered G4 notes with ordinary natural signs; no glyph-loss warning | **Incorrect**: importer + no named-glyph carrier |

The machine report lists every variant note ID and gives individual dispositions for
the mixed `01e` and `01f` cases. In `01e`, **2** plain baseline notes are correct,
**6** explicit enclosures are wrong, and **8** default-styled combinations remain
unresolved visually. In `01f`, **1** plain sharp is correct, **12** fractional-pitch
variants are wrong, and **3** ordinary-sharp qualifier variants remain unresolved
visually. “Unresolved” is a bounded judgment, not a hidden pass: the importer
still drops those source attributes.

## Real desktop authoring

Every feature has an explicit create, inspect, change and remove task in the machine
report, in both shells. A **partial** result below names the tested subset; it does
not extend to every variant. No JSON edit, internal operation or AI action is credited
as a direct control.

| Feature family | Create / inspect / change / remove | Evidence and limit |
|---|---|---|
| `01a.pitch-sequence` | Partial / Partial / Partial / Partial | On the first G2 in both shells: Enter shows `pitch:G2`; Alt+↑ writes G♯2; Delete leaves the rhythmic cell; N recreates G2. All three mutations preserve unrelated content and exactly undo/redo. Higher registers and spellings were not individually authored. |
| `01e.accidental-qualifiers` | Partial / Partial / Partial / Partial | On its first note in both shells: the imported inspector says `accidental show`; `no accidental`, `accidental parens`, `accidental show`, then `accidental parens` make exact note-level changes with exact undo/redo. The final MNX has `{show:true,enclosure:{symbol:"parentheses"}}`, but both screenshots still draw a bare flat. Brackets, editorial meaning and combined cases have no proved direct control. |
| `01b.interval-ladder`, `01c.lyric-anchor` | Unresolved except partial inspection | Pitches and lyric A appear in captures, but this slice did not perform source-specific mutation/history tasks for these variants. Existing generic editor smokes are not promoted to fixture passes. |
| `01a.explicit-accidentals`, `01a.accidental-qualifiers` | Unresolved | First-note and `01e` inspector probes do not prove exact natural, double, cautionary or editorial controls on bar 27. |
| `01c.omitted-voice` | Not applicable | Optional XML tag omission is a serialization choice; MNX has a single internal voice, not a direct musical editing object. |
| `01d`, `01f`, `01g`, `01h` exact special pitches/glyphs | Blocked | Imported MNX lacks the exact source values or named glyphs, so create/inspect/change/remove of those exact variants cannot be proved through the desktop editor. |

The UI paths and per-task structural expectations are recorded on all **88** task
rows. The first-note probes are deliberately narrow. Selection context was a
desktop pointer, a focused viewer and note-rung inspector; the two shell bindings
were reached through their real entry paths. No touch editing was attempted.

## Save and reopen are separate judgments

| Edited state and route | Observed reopened state |
|---|---|
| Workbench `01a` / `01e`: JSON panel → Copy document → harness writes clipboard to `.mnx.json` → Open… | Exact final MNX equality. The harness supplies the file save; Workbench has no claimed built-in MusicXML download from this proof. |
| Studio `01a`: Save now → GP checkpoint → reload | **108 → 93 notes**. Fifteen high notes are replaced by rests; the selected first-note edit and library title survive. Source XML stays byte-identical. |
| Studio `01e`: Save now → GP checkpoint → reload | **16 → 16 notes**, but all 16 `accidentalDisplay` values disappear, including the newly authored parenthesis. Source XML stays byte-identical. |
| Studio Library → Export MNX, MusicXML, Guitar Pro 7, each opened through Workbench | These controls export the **saved canonical GP**, not the unsaved edited XML state. All three `01a` downloads reopen with 93 notes; all three `01e` downloads reopen with 16 notes and no explicit accidental display. Their bytes and reopened documents are retained separately. |

These routes have separate rows in the report for every feature. Other variants'
save survival is marked unresolved or blocked; the exact Workbench MNX proof and
Studio losses are not generalized across the corpus. Studio's Versions workflow
preserves the original rendition while an editable version is current. An original
rendition is evidence of provenance, not a lossless edit checkpoint.

## New gaps and remaining coverage

[Completed item 22](../roadmap/complete/core-musicxml-render-gaps.md) already
delivers fractional-pitch warnings and defers their carrier decision. [Completed
item 23](../roadmap/complete/core-musicxml-write-gaps.md) already repairs the
untitled-version workflow and records `01a`'s GP loss without repairing it.
The new [bounded accidental-fidelity proposal](../roadmap/proposed/core-musicxml-accidental-fidelity.md)
owns explicit enclosure import/render, named-glyph diagnostics and representation,
direct editor controls, and the newly measured accidental-display GP loss.

The 183-file suite still needs the remaining families' feature/task dispositions;
the meter review is a bounded earlier slice rather than a current full-feature pass.
Within `01a`–`01h`, unresolved authoring rows and default-style glyph policy remain
explicit in the machine report. Neither assessment item is complete.
