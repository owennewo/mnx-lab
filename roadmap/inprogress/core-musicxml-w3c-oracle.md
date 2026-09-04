# The W3C comparison oracle — 27 pairs the spec wrote for us

> **Status: BUILT 2026-09-04.** Item 1 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md), and the item that
> reports the campaign's baseline. **The baseline is 0 match / 1 spacing / 26 content**,
> and the 26 collapse into roughly eight causes, two of which account for eleven
> scenarios. Kept in `inprogress/` while the campaign's early items consume it.

## What this is

The MNX spec ships 27 `spectools.exampledocumentcomparison` records: one worked example
in MNX, and the same music written in MusicXML 3.1, both authored upstream. We already
mirror the MNX half as `scenarios/spec/<slug>/`, with layout goldens and human
verification records attached.

So for 27 slugs there is a canonical answer to "what should importing this MusicXML
produce", **and we did not write it**. That is the only oracle in the converter's life
that is not our own opinion, and it was sitting unused in the tree.

## The agreement block

Per the campaign's shared contract:

1. **The oracle** — itself. The structural diff it cannot see is named below.
2. **The MNX verdict** — none needed. This item adds no converter features, so it
   proposes no `_x.mnxLab` and touches no schema.
3. **The dependency budget** — no new dependency of any kind, runtime or dev.
4. **The matrix row** — none yet; item 2 consumes this report as its first input.
5. **The losslessness bar** — not applicable to a measuring instrument. The bar this
   item is held to instead: **the baseline is committed and moving it in either
   direction is a red test.**

## Why the comparison is at the primitives layer

The obvious assertion is that the imported document deep-equals the reference MNX. It
cannot pass, and writing it would have been the campaign's first mistake. **MusicXML →
MNX is not a bijection**: ids, voice numbering and ordering, beam nesting and how a
sequence is split all admit several correct encodings. An assertion that fails for
reasons nobody cares about gets weakened until it means nothing.

`expected.primitives.json` carries **no ids at all** — it is geometry plus SMuFL glyph
names. Two documents that lay out identically are the same music, whatever they called
their notes. So the oracle is: import → `layoutNotation` (via `engine/headless.ts`,
through `harness/helpers/corpusPrimitives.ts`) → diff the committed golden.

**Its limit, stated so no later item forgets it:** the comparison is renderer-mediated
and cannot see what layout ignores. Anything the engine does not draw is invisible here
and needs a structural check of its own. That is why a near-miss is *graded* rather than
just failed:

| Verdict | Meaning |
|---|---|
| `match` | the whole notation system is identical, coordinates included |
| `spacing` | same glyphs in the same order, different positions — same music, spaced differently |
| `content` | different music, reported as the glyph multiset delta |
| `import-failed` / `layout-failed` | threw, with the message |

## What was built

| Piece | |
|---|---|
| `spec/tools/specSource.mjs` | `loadMusicXmlComparisons()` — keeps all `data.json` reading in the module that already owns it |
| `spec/tools/sync-musicxml-comparisons.mjs` | mirrors the 27 into `converters/fixtures/w3c-comparisons/`, prunes orphans, writes the attribution README. `npm run sync:musicxml-comparisons` |
| `converters/fixtures/w3c-comparisons/` | the committed fixtures — **generated, do not hand-edit** |
| `harness/conformance/musicxml-oracle.test.ts` | the oracle, plus the pairing tripwire |
| `harness/reports/musicxml-oracle.json` | the committed baseline. `npm run update:musicxml-oracle` |

**The fixtures are committed on purpose.** `git worktree add` does not populate
`vendor/mnx` and a fresh clone has it empty, so a test that read the submodule directly
would be a test that most checkouts skip. This is the same reasoning that has
`sync:spec` commit `scenarios/spec/` rather than deriving it at run time.

## The baseline, and what it found

**0 match, 1 spacing (`dotted-notes`), 26 content.** No import or layout crashes — every
one of the 27 parses and lays out. The 26 are not 26 problems:

| Cause | Scenarios | Evidence |
|---|---|---|
| **`<beam>` not imported** | 7 — `beams`, `beam-hooks`, `beams-across-barlines`, `beams-inner-grace-notes`, `beams-secondary-beam-breaks`, `parts`, `tuplets` | beam `line`s missing, flag glyphs (`flag8thUp`, `flag16thDown`…) in their place |
| **`<tied>` / `<slur>` not imported** | 4 — `ties`, `slurs`, `slurs-chords`, `slurs-targeting-specific-notes` | `curve` primitives missing outright |
| **augmentation dots** | 4 — the `repeats*` family | `augmentationDot` missing |
| **jumps** | 2 — `jumps-dal-segno`, `jumps-ds-al-fine` | `segno` glyph and *D.S.* / *fine* text missing |
| **a stray `rect`** | 3 — `hello-world`, `two-bar-c-major-scale`, `repeats-alternate-endings-advanced` | nothing missing, one `rect` extra — almost certainly a diagnostic badge, so these are the closest to matching |
| **multi-voice** | 1 — `multiple-voices` | imports to zero measures |
| **chord + rest** | 1 — `three-note-chord-and-half-rest` | noteheads and `restHalf` missing |
| the rest | 4 | `time-signatures`, `key-signatures`, `accidentals`, `ottavas-8va` |

The three `rect` scenarios are the cheapest wins in the set and should be looked at
first: nothing is missing, so the music imported correctly and the renderer is flagging
something.

## The finding that matters most

`tied` appears **zero times** in `converters/musicxml-mnx/src/` — neither import nor
export. `beam` appears once, in export only. And **none of the three guitar fixtures
contains a single tie.**

So the converter's 46 round-trip invariant tests pass, over three fixtures, across a
feature that is not implemented in either direction. That is not a gap in the tests'
rigour; it is the shape of the oracle. **A round trip is blind to a symmetric omission** —
drop a feature on import and on export and the round trip is perfectly lossless and
perfectly empty — and **fixtures drawn from one genre cannot find what the genre does not
contain.** The campaign wrote both of those down as arguments on 2026-09-04; the oracle
demonstrated both on live code the same day.

This is the concrete case for the campaign's ordering: item 1 before item 4, and the
support matrix (item 2) before any feature item, because "the round trip is green" was
never evidence of support.

## What this item deliberately does not do

**No converter code changed.** The point of a measuring instrument is that it is built
before the thing it measures is touched, so the baseline is a fact about the code as it
was found. Every cause in the table above is a future item's evidence, not this item's
work list.
