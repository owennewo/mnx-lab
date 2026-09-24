# MusicXML notehead fidelity — shapes, slash spans and hidden ink

> **Status: proposed, 2026-09-24.** MusicXML campaign item 30, from the bounded
> [22a–22d render assessment](../../docs/musicxml-notehead-assessment.md).
> Serves the implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** the four pinned MusicXML originals and manifest descriptions, official MusicXML notehead, slash and note-visibility semantics, exact source-to-import checks and retained current both-shell captures. The 62 feature IDs and 490 source variants in the [assessment](../../docs/musicxml-notehead-assessment.md) are the regression inventory. Nonempty SVG is not a shape verdict.
2. **MNX verdict:** published `note` has no general head value, fill override, parentheses or print visibility; measures have no slash-style span. Full support needs deliberate spec-loop proposals named `notehead-display` and `notation-visibility`, with slash notation's duration/voice scope decided there. This item invents no standard or `_x.mnxLab` field. Published event `lyrics.lines` already carries `22c`'s numbered member labels, and published `rest.staffPosition` already carries the `22d` height (owned by item 25).
3. **Dependencies:** no new runtime dependency or notation library. Use the existing importer, SMuFL renderer and shared viewer/editor binding.
4. **Matrix:** any converter behavior change regenerates converter support observations; screenshots alone never upgrade a support cell.
5. **Losslessness:** each selected source control either survives into an agreed carrier and both original-file shell views, or emits a precise source-located warning. Engine/model changes re-earn primitives and register verification debt in [lab-verify](../inprogress/lab-verify.md); no hand-edited scenario verification.

## P1: stop silent notehead substitution

`22a` supplies 114 explicit notehead declarations across 32 bars, including 42 `filled=no` attributes, `none`, directional arrows and seven Aiken shapes. `22c` supplies eleven explicit per-chord-member heads. `22d` supplies eight `parentheses=yes` requests, including two on rests. All are absent from imported MNX, and both shells substitute ordinary heads or unenclosed rests without a notehead warning. A rendered black oval is especially misleading for `none`, x, the named shapes and the unfilled ordinary quarter pair.

First acceptance is containment: warn at each unsupported part/measure/source note with the exact head value and requested fill/enclosure attributes, while keeping pitches, durations, chord groups and rests intact. Distinguish the default-equivalent `normal` half note from a visually material loss. The warning must appear in the actual Workbench and Studio original-file paths. A full representable solution waits for `notehead-display`: define per-note identity and fill/enclosure semantics, map the source values to appropriate SMuFL ink, and test all 114 `22a` controls, eleven `22c` shaped members and eight `22d` parenthesized controls against imported MNX and both-shell captures. Include `none` without deleting its timed event. Do not infer the tab `dead` technique from MusicXML's visual x head.

## P1: restore numbered chord-member labels with the existing carrier

`22c` writes three numbered lyric labels on different members of each chord. Imported MNX keeps only line 1 of each event, so All verses displays four of twelve words. Published event `lyrics.lines` can retain lines 1, 2 and 3; this does not need a new carrier. Acceptance: assert all twelve source texts and numbers against the four imported events, recapture with All verses selected in both shells, and confirm each member's label remains associated with its chord without changing pitch/rhythm. Cross-check `61i-Lyrics-Chords` when the lyric family is assessed; do not claim its unreviewed variants from this case alone.

## P1: diagnose slash spans and hidden-note intent

`22b` has two quarter-slash start/stop spans, one without stems and one with stems. It also marks eight notes `print-object=no` and explicitly preserves lyric printing on the first hidden note of each bar. The importer drops all four slash declarations and ten note visibility/lyric override attributes; ordinary pitched notes print throughout. The zero-line staff of bar 5 already receives item 22's precise warning, but its notes and slash bars do not.

First acceptance: warn on each unsupported slash span and hidden-note/lyric override, naming bar, onset, style and scope. Keep the correct note durations, pitches and all retained lyric lines. Full visual support waits for the `notation-visibility` carrier decision: distinguish suppression of note ink from loss of the musical event, preserve explicit print-lyric permissions, and represent the paired slash spans and use-stems choice without turning them into per-note `slash` heads. Recheck both bars and both hidden-note bars through original-file browser captures, including All verses and the restored sixth bar.

## Deduplication and authoring limit

[Completed item 22](../complete/core-musicxml-render-gaps.md) already diagnoses `22b`'s zero-line staff and the incompatible common-time symbol on `22d`'s 6/4; full nonstandard staff geometry is its documented deferral. [Proposed item 25](core-musicxml-rest-fidelity.md) already owns `22d`'s explicit E4 rest position through published `rest.staffPosition`. Neither becomes a duplicate task here. [Completed item 23](../complete/core-musicxml-write-gaps.md) made the Studio XML versions editable for this assessment, without proving their GP save paths.

The review did not exercise direct creation, inspection, change, removal, undo/redo or persistence for these IDs. [Write item 19](../inprogress/core-musicxml-write-assessment.md) owns those tasks through the single desktop editor binding. Any future implementation must check structural mutation and unrelated-content preservation, Workbench MNX reopen, Studio editable version and lossy GP storage, and each applicable download/reopen route separately. A raw JSON edit is not a user-facing control.
