# The round-trip comparator and the Guitar Pro loss register

> **Status: complete 2026-09-17.** Item 1 of the
> [studio authoring campaign](../inprogress/studio-campaign-authoring.md) and bound by its contract
> (clauses 3–4: no save is silent about loss; every difference must be explained by a
> warning). Implementation loop. No golden moved; no verification debt.

## Why

Studio stores `.gp` and works in MNX, so every save crosses the Guitar Pro exporter and
every load crosses the importer. Before a person is shown "2 items won't persist", something
has to be able to say what a round trip lost — and be right about what it did *not* lose.
The only comparison that existed lived in the converter's tests and flattened notes and
rests; it could not see a slur, a chord symbol or a title, and nothing in `src/` could
import it.

## What was built

- **`src/model/documentCompare.ts`** — pure, DOM-free, imports nothing.
  `canonicalizeDocument`, `compareDocuments(before, after)` → differences as
  `{path, kind: 'lost' | 'gained' | 'changed', before?, after?}`, and
  `collapseDifferences` → path *shapes* (array indices become `[]`) with counts.
  - `_x.mnxLab.encoding` is dropped: whoever writes the file stamps it.
  - **Identity lives in the references, not in the ids.** Each reference is rewritten to the
    path of the object it resolves to, and every `id` is then dropped. A retargeted slur is
    a change; a respelled one is not. A dangling reference stays as spelled, and so does a
    duplicated id with everything pointing at it — defects stay visible.
  - Arrays of equal length are compared index-wise; when the length changed, as multisets
    of their members, reported at index `-1` — a splice is its members, not every shifted
    index (the idea is `harness/helpers/docDiff.ts`'s, which `model/` cannot import).
  - `ID_REFERENCE_FIELDS` names every referring property. It is not trusted: the test
    derives the same inventory from `spec/mnx-schema.json` (`id`, `id-list`, `id-pair`) and
    `spec/mnx-lab-extensions.schema.json` (`note-id`, and the inline id pattern that
    navigation `target`/`resumeAt` use) and goes red when either schema grows a reference
    the table does not name. `sound` and `kitComponent` refer to object *keys* — authored
    names, not generated counters — and are never rewritten.
- **`harness/conformance/document-compare.test.ts`** — the judge proved before it judges.
  What is *not* a difference comes first: the same music under entirely different ids
  (respelled by text substitution, deliberately ignorant of the module's table), ids swapped
  between two notes with every reference following, ids nothing references, a different
  `encoding`, key order. Then what is: retargeted, crossed, dangling and duplicated
  references, and that one lost slur is one difference rather than a cascade. Mutation-checked
  by removing `events` from the table — the respelling proof and the schema inventory both
  fail.
- **`harness/conformance/roundtrip-register.test.ts`** and the committed
  **`harness/fixtures/roundtrip-register.json`** — two lanes, both exported with the storage
  options below: `corpus` (each scenario's MNX → `.gp` → MNX, judged against itself) and
  `fixture` (`converters/fixtures/*.gp*` → MNX → `.gp` → MNX, the two imports compared —
  the library's case). Per document: a verdict, the difference shapes, and the exporter's
  warnings with numbers and quoted names blanked. On top, two ranked lists —
  `lostOrChanged` (the converter backlog) and `gained`. The test fails when the register
  changes; `npm run update:roundtrip-register` regenerates it and **git diff is the review**.
- **An operator lane, never committed.**
  `ROUNDTRIP_DIR=<dir> ROUNDTRIP_REPORT=<out.json> npx vitest run harness/conformance/roundtrip-register.test.ts`
  runs the fixture lane over a private library and writes the same report — refusing a path
  inside the repo. The library is copyrighted tabs; its findings are recorded here as shapes
  and counts only.
- **`STORAGE_EXPORT_OPTIONS`** in `converters/guitarpro-mnx/src/gpif/fromMnx.ts` — the
  exporter options for a file that will be *read back as the document*. Found by this item
  (finding 2); **campaign item 3's save path must export with it.**

## Four verdicts, not two

The campaign planned `clean | differs`. The evidence wanted a third before it was an hour
old: **`gains`** — nothing that went in was lost or changed, but the document that comes
back says *more*. Guitar Pro has no "unstated": a track always returns with a tuning, a
key, a transposition and a voice name. 128 of 130 corpus documents gain
`parts[].transposition`; 98 gain a part-level `_x` (strings). That is not loss, and it is not
nothing: **a notation-only part reloads as one with six strings**, which collides with the
workbench rule that no instrument is ever assumed. `error` is the fourth (the exporter or
importer threw); no document produces it today.

## Findings

Numbers are at 2026-09-17, storage options on.

1. **The library's lane is nearly clean, and where it is not, a warning says why.** Of the
   eight committed fixtures seven are clean; the eighth (`Binary-suite.gp5`) loses two bend
   points and the exporter says so ("a bend curve with more turns than Guitar Pro's
   origin/middle/destination model was simplified"). The contract's rule — every difference
   explained by a warning — holds on the committed `.gp` sources.
2. **The exporter's default is wrong for storage.** `collapseTabUnisons` (default true)
   writes a note held in two voices at one string and fret once — tidy for a person, but the
   second voice's event re-imports **as a rest**. On the private library that was 386 events
   across 9 files, 136 and 172 of them in two fingerstyle pieces. It was *warned*, which is
   why it would have reached users as a wall of "won't persist" rather than as silence.
   `STORAGE_EXPORT_OPTIONS` turns it off; the private library went from 76 clean / 41
   differing to **86 clean / 7 gains / 30 differing** of 123 files.
3. **The private library's backlog, unexplained first.** 22 of the 30 differing files carry
   **no warning at all** — by the contract, converter defects:
   - **chord symbols** — `global.measures[]._x` lost in 14 files, 123 `harmonies` entries in
     8 of them, silently;
   - **lyric syllable `type` changed** in 10 files;
   - **part-measure `directions` lost** in 4 files (and *gained* in 12 — text is moving
     between homes on the way round);
   - **tie `target` changed** in 2 files, `hammerPull.target` in 1 — references that resolve
     somewhere else after the trip, which only a by-resolution comparison can see;
   - two files lose ~1,600 notes between them to "pitch is outside the instrument's range on
     this tuning; the note was skipped" — warned, and severe.
4. **The corpus lane is the honest measure of authoring in MNX, and it is not flattering:**
   0 clean, 30 gains, 100 differing, 76 of those with no warning. Much of it is Guitar Pro's
   shape rather than a bug — `layouts`, `scores`, `staves`, `beams`, `mnx.support`, colours,
   kit notes — and much is not: `clef.octave` lost in 26 documents, `barline` in 14,
   `_x.mnxLab.string` *changed* in 8, `pitch.step` changed in 2, `accidentalDisplay`,
   `fermata`, `measureRepeat`, `fingering`, slur `side`. **Every silent one owes either a fix
   or a warning**; the register's `lostOrChanged` list is that backlog, ranked by how many
   documents each shape bit.
5. **Metadata mostly survives** — the answer campaign item 3 asked for. Across the whole
   register `_x.mnxLab.work` loses exactly two things: `source`, and a `creators[]` entry
   whose role Guitar Pro's header has no field for. Title, subtitle, artist, album and the
   header's own roles come back. The Details sheet's field list stands as drafted.
6. **Layout state does not survive**, answering the campaign's open decision 5: `layouts`,
   `scores` and `parts[].staves` are lost wherever they appear. Studio should not offer
   layout authoring over `.gp` storage.

## What this item did not do

- **Fix a converter.** The register is the backlog; fixes are their own work, each one a
  register diff.
- **Compute explained versus unexplained.** Warnings are free text, so "no warning at all" is
  the only mechanical reading available. Structured warnings (`{code, where}`) and a computed
  verdict are the follow-up, and campaign item 3 can ship on `clean | gains | differs` without
  them.
- **Align spliced arrays.** A dropped event mid-sequence reports its lost member and shifts
  the path-named references behind it. Collapsed to shapes that is a count; a user-facing
  loss list in item 3 may want real alignment.
- **Touch the app.** `src/importers/exportFile.ts` still exports with the defaults, which is
  right for a download.
