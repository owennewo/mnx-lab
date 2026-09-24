# MusicXML clef fidelity — carry octave signs and diagnose ungrounded TAB

> **Status: proposed, 2026-09-24.** MusicXML campaign item 27, from the bounded [12-series render assessment](../../docs/musicxml-clef-assessment.md). Serves the implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** the two pinned original MusicXML files, manifest descriptions and hashes, source-to-browser-imported MNX inventory, and complete Workbench/Studio captures in the [clef assessment](../../docs/musicxml-clef-assessment.md). Source musical pitches and clef attributes are checked separately from ink.
2. **MNX verdict:** G/F `clef.octave` and `staffPosition` are already published MNX; no extension is needed for the four octave clefs. A standalone TAB sign without known strings has no established single-source notation mapping here. Diagnose that loss first; any future carrier or tablature conversion requires an explicit spec-loop decision and source strings.
3. **Dependencies:** no new runtime dependency or notation library.
4. **Matrix:** if converter behavior changes, regenerate its support matrix and independent-oracle evidence; an SVG or round trip alone does not upgrade a cell.
5. **Losslessness:** the four octave values survive import with unchanged C4 sounding pitches, and the original-score browsers draw the correct octave figures and written heights. A TAB sign with no strings is never silently projected as the preceding clef. Existing scenario goldens and verification provenance follow the repository rules if an implementation changes model/engine behavior.

## P1: import four transposing clefs

`12a-Clefs` bars 6/7/13/14 state G2/F4 with octave changes -1/-1/+1/+1. Both current editors import the clefs without `octave`, draw ordinary signs and seat each sounding C4 as an unshifted note. The importer tracks only sign and line; the renderer already accepts published `clef.octave` and has octave glyphs.

Acceptance: read `clef-octave-change` per staff, emit MNX `clef.octave`, and include octave in the change-only identity so a change on the same sign/line is not discarded. Assert exact four source-to-MNX values and note pitch preservation. In both original-file browser shells, check the four octave figures and the written C4 heights, with no regression to the ten ordinary line variants or `12b` implicit treble. Add converter regression cases for 8vb and 8va and run the affected converter suite, root gates and relevant browser smoke.

## P2: make an ungrounded TAB clef loss explicit

`12a` bar 15 requests `<sign>TAB</sign><line>5</line>` but declares no string tuning or string assignments. Current import silently omits the clef, leaving the preceding F clef active and making the printed C4 look definitively F-clef pitched. Tab/Both are correctly unavailable without known strings; inventing a tuning would conceal the source ambiguity.

Acceptance for this bounded item: emit a source-located diagnostic naming the unsupported TAB clef and missing strings, and avoid a misleading inherited-clef pitch claim at bar 15. Keep all other bars visible. Decide any full TAB carrier and pitch-to-string policy separately through the campaign's spec-loop contract. A synthetic tuned TAB example must remain distinguishable from this ungrounded source.

## Deduplication and deferrals

[Item 22](../complete/core-musicxml-render-gaps.md) already delivered ordinary clef line coordinates and local placeholders for unsupported signs, including the percussion and deprecated `none` measures in `12a`. This item does not reimplement that containment. MusicXML says `none` notes use treble placement, but published MNX has no blank-sign clef carrier; full fidelity for `none` and percussion requires the deferred representation decision. [Item 23](../complete/core-musicxml-write-gaps.md) already fixed the Studio title workflow. This render proposal does not claim editor controls or GP persistence, which belong to [item 19](../inprogress/core-musicxml-write-assessment.md).
