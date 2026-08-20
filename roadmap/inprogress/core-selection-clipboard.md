# Selection clipboard — typed copy, cut and paste across the ladder

Serves the **implementation loop**. Proposed 2026-08-16 after the completed
[selection ladder](../complete/core-selection-ladder.md) made every point,
range and live closure resolve to ordered model members.

> **Status: in progress — stages 1–4 built 2026-08-16, stage 5 built
> 2026-08-20.** Stage 1 landed the
> versioned DOM-free clip union, strict codec, asynchronous string-only store
> seam and workbench-lifetime memory owner. Stage 2 added pure
> `extractSelectionClip()` materialization for all nine clip kinds: it resolves
> once; fixes point/range/closure membership and sparse bar offsets; filters
> staff/voice-owned declarations; refuses partial rhythm containers; closes
> ties, slurs, beams, techniques and ottava measure references; reports every
> detached outgoing reference; collects measure context, source support and
> only referenced lyric metadata; and proves the immutable result through the
> same serialized codec path the store will use. `selection-clip.test.ts` and
> `selection-clip-extraction.test.ts` pin the transport and extraction
> contracts. Stage 3 added `planSelectionPaste()`: it decodes the serialized
> value, validates payload/version/destination compatibility, preserves sparse
> bar offsets and translated onsets, requires exact per-bar metric closure,
> maps all nine clip kinds conservatively, rewrites every copied id and retained
> reference, rebinds measure context, validates destination fingerboards,
> merges dependencies with destination precedence, repairs detached target
> references, and returns a complete detached next document plus landing/id
> metadata or one typed refusal. Planning exposed and fixed an underspecified
> Stage 2 shape: event/container runs now retain relative bar offsets and
> bar-local starting onsets, so a sparse phrase cannot silently collapse time.
> `selection-paste-planner.test.ts` pins the acceptance/refusal matrix, purity,
> id/reference rewrites, dependency/context precedence, empty-document cases
> and sparse timelines. Stage 4 added the atomic `pasteSelection` edit op,
> exact metric/structural landing metadata, pasted-range selection, and
> selection-aware undo/redo snapshots. `applyPastePlan` traces carry the
> already-materialized plan rather than a contextual clipboard read, so replay
> is deterministic. `selectionClipboardActions.ts` now owns the asynchronous
> extraction/store and read/plan boundaries; the workbench's app-lifetime
> memory store is reachable from explicit selection-tray actions and therefore
> survives cross-score navigation. `selection-clipboard-actions.test.ts` pins
> cross-session transfer, one-entry history, note-line and range landing,
> part/score closures, empty-store refusal and replay after the store changes.
> Stage 5 added `planSelectionCut()` plus the shared
> `selectionStructuralEdit.ts` helpers (staff-material replacement, part
> removal with conservative layout/score repair, timeline-column removal with
> multimeasure-rest rewriting, dangling-reference pruning) — one module used
> by both paste and cut, so their repair semantics cannot drift. Cut follows
> the rung table exactly: chord-member removal, clear-to-rests, equal-span
> container silence, voice/staff-bar removal with their owned declarations,
> whole-part closure, measure/section timeline closure; score cut refuses.
> `cutSelectionToStore` extracts and plans first, awaits the store write, and
> refuses on write failure or a stale session (document, selection or
> projection changed during the await) before releasing the materialized
> `applyCutPlan` into history — one entry, selection-aware undo/redo,
> clipboard-independent trace replay. Extracting the shared module initially
> dropped staff-bar beam transfer from paste; the regression is fixed and
> pinned by beam tests on both the paste and cut sides.
> `selection-cut.test.ts` pins the rung matrix, structural repair,
> write-before-mutate, stale-session refusal, replay and the score refusal.
> Stage 6 bound Ctrl/⌘+C/X/V as **shell actions**, not EditorIntents — the
> mount resolves the store I/O and the trace keeps recording the materialized
> `applyCutPlan`/`applyPastePlan`, never the keypress — behind the existing
> `keyIsOurs` focus gate (text fields keep native copy/paste via the
> innermost scope test). The cheatsheet gained the three rows: copy and
> paste level-independent, cut spelling its per-rung removal table with the
> score row absent, guard-mirrored against `planSelectionCut`'s refusal.
> Feedback is a transient notice strip over the score, no clipboard panel:
> `src/edit/clipboardFeedback.ts` (DOM-free) owns the sentences — clip kind,
> member count in the rung's own unit, boundary-detached and score-repaired
> reference counts, landing bars, and the planners' precise refusal text,
> with cut's write-failure naming the score-unchanged guarantee. The tray's
> three clipboard tiles now show their shortcuts.
> `clipboard-feedback.test.ts` pins the notice sentences end-to-end through
> the real actions and asserts the strokes resolve as shell actions while no
> keymap layer claims them as intents; the keymap-docs joins force the
> documentation rows. **Next: stage 7, hands-on cross-score review.**
>
> **2026-08-20, from the first hands-on pass:** two review verdicts became
> proposals. The note-rung range proved confusing and valueless — retired by
> [core-selection-floor-axis.md](../proposed/core-selection-floor-axis.md)
> (a note selection becomes exactly one notehead; horizontal gestures
> re-level to the event rung). And **Contract 3 below is superseded** by
> [core-paste-lands.md](../proposed/core-paste-lands.md): a decodable clip
> always lands — footprint overwrite, rest fill, timeline/part extension,
> land-and-flag via the renderer's diagnostics — with undo as the license,
> as it already is for cut. Contract 3 stays in this doc as the record of
> what stages 3–6 built and verified; the refusal matrix it pinned becomes
> the accommodation-record matrix when that proposal lands.

## The boundary

This item owns **copy, cut and paste of the current selection**, including
cross-document paste while the workbench remains open. It does not own new
selection gestures, entry advancement, generic document storage or arbitrary
musical transformations.

The clipboard is typed by the selection rung. A note range is not a phrase: it
contains existing note ink but not rests or event rhythm. An event range owns
that rhythm; bar-oriented rungs own progressively more complete passages. Copy
must preserve that distinction rather than flatten every enclosure to a list of
note ids.

The first transport is deliberately **application-internal**. No system/OS
clipboard integration lands in this item. The implementation must nevertheless
keep transport behind one serialized boundary, so replacing the internal store
later changes neither clip semantics nor edit behavior.

## Current substrate

The hard selection work is already built:

- `SelectionState` records a level plus a concrete interval or live closure;
- `resolveSelection()` returns ordered structural members, including rests,
  containers and empty bar copies, plus their canonical note keys;
- Ctrl+A at `partMeasure` is the whole active part, because part is a horizontal
  closure rather than a ladder rung;
- bulk edits are one history entry and can preserve the selected range through
  apply, undo and redo;
- destructive edits already prune dangling ties, slurs, beams and technique
  references.

What does not exist is a durable value representing the selected material. A
raw `SelectionState` is not one: its cursor addresses and closures resolve live
against one particular document. Copy must materialize an immutable snapshot.

## Contract 1: one transport-neutral clip value

`src/edit/selectionClip.ts` owns a DOM-free, versioned discriminated union and
its JSON codec. The exact field names are settled in implementation, but the
shape is:

```ts
interface SelectionClipEnvelope {
  format: 'mnx-lab-selection-clip';
  version: 1;
  source: {
    mnxVersion: number;
    extensionVersion: number;
  };
  selection: {
    level: SelectionLevel;
    shape: 'point' | 'range' | 'closure';
  };
  clip: SelectionClip;
  context?: ClipContext;
  dependencies?: ClipDependencies;
}

type SelectionClip =
  | NoteSetClip
  | EventRunClip
  | ContainerRunClip
  | VoiceBarsClip
  | StaffBarsClip
  | PartClip
  | MeasuresClip
  | SectionClip
  | ScoreClip;
```

Copy resolves a live selection once and serializes the result immediately.
The clipboard never retains document objects, note keys as source addresses,
closures, or mutable references into an `EditorSession`.

The initial store is scoped above an individual session so changing scenario or
document does not clear it:

```ts
interface SelectionClipboardStore {
  write(serialized: string): Promise<void>;
  read(): Promise<string | null>;
}
```

The workbench supplies `MemorySelectionClipboardStore`, whose only state is the
serialized string. The interface is asynchronous even though memory is not:
cut must already await a confirmed write before deleting, and a later transport
must not force that safety ordering through the rest of the editor. `edit/`
imports no browser API and knows nothing about the store implementation.

There is one codec and one paste path. The memory store is not allowed to keep
a richer private object beside the string; otherwise same-session paste could
silently behave differently from a later transport.

## Contract 2: the rung determines the copied unit

| Selection level | Clip kind | Owned payload |
|---|---|---|
| `note` | `note-set` | selected note objects and note-owned accidental, tie, fingering, string and technique data; no event duration or rests |
| `event` | `event-run` | ordered timed events, including chords, rests, duration, lyrics and markings |
| `container` | `container-run` | complete tuplet, grace or tremolo objects and their contents |
| `voiceMeasure` | `voice-bars` | selected sequence/bar copies for the active staff and voice |
| `partMeasure` concrete range | `staff-bars` | selected staff-local bar material and part-measure declarations |
| `partMeasure` part closure | `part` | the complete active part across every staff and measure, including part declarations and `_x.mnxLab` setup |
| `measure` | `measures` | selected global measure columns plus every part's corresponding measure copies |
| `section` | `section` | section labels plus the complete measure spans they name |
| `score` | `score` | the complete MNX structure |

Point, range and closure affect member count, not the clip vocabulary. A live
closure becomes a fixed snapshot at copy time; later edits and appended bars do
not change what was copied.

### Structural closure

A copied value must be independently meaningful:

- a note clip may copy chord members without their event rhythm because that is
  exactly the note rung's contract;
- an event range may not bisect a tuplet, grace or tremolo. A range enclosing a
  whole container carries the wrapper; a partial one refuses and asks the user
  to select the container;
- internal ties, slurs, beams, ottavas and technique targets are retained only
  when both ends are inside the clip;
- references crossing the boundary are detached and counted in the copy/paste
  result, never left dangling or silently redirected;
- copied ids are source-local evidence only. Paste always mints new ids and
  rewrites every retained internal reference.

The clip separates **owned payload** from **context/dependencies**. A whole part
owns its measures and part declarations but not the score's repeats, rehearsal
marks, harmonies, layouts or presentations. It may carry global measure ids,
time/key context, support declarations and referenced lyric metadata so it can
bootstrap an empty target. A populated target keeps its own global context;
clipboard context never overwrites it implicitly.

## Contract 3: paste is typed and conservative

Paste reads the serialized value, parses the envelope, upgrades supported older
clip versions, validates the payload and computes a pure `PastePlan` before the
document changes. A plan either contains a complete atomic edit or a specific
refusal; there is no partially applied paste.

The initial compatibility rules are deliberately narrow:

| Clip | Valid destination and default meaning |
|---|---|
| `note-set` | one destination note replaces one note; two ranges map one-to-one and require equal member counts. It does not merge chord tones or invent event rhythm |
| `event-run` | replaces an equal metric event span in one staff/voice. A point may anchor the following exact span; failure to close exactly refuses rather than retiming the bar |
| `container-run` | replaces complete containers or an exactly equal structural span; wrappers are never flattened |
| `voice-bars` | overwrites the same number of bar copies in the target staff/voice; it cannot shift only one voice against the global timeline |
| `staff-bars` | overwrites the same number of target staff bars and their staff-owned declarations |
| `part` | adds a part; a truly empty placeholder is replaced rather than retained beside it |
| `measures` | a destination range of equal length is replaced; at a point, complete measure columns are inserted before that measure |
| `section` | inserts or replaces its complete measure package, including the section boundary |
| `score` | replaces only an explicitly empty/new document; it is never inserted into a populated score |

No initial paste truncates, tiles, rhythmically fits, merges chord tones or
silently maps incompatible staves/voices. Those are named future commands, not
hidden branches of Ctrl+V. Paste into a missing voice or staff follows
[core-entry-surface.md](../proposed/core-entry-surface.md); this item must not invent its
own sequence-creation policy.

The destination's projection changes only spatial landing. Notation and tab
are views of the same clip. Guitar string/fret annotations remain part of the
note payload, but paste revalidates them against the destination's declared
strings/capo and reports incompatibility; no instrument is assumed.

After success, the pasted material is selected at the clip's natural rung.
Paste is one history/log entry. Undo restores both the document and the prior
selection; redo selects the pasted result again.

## Contract 4: cut writes first, then removes exactly the selected unit

Cut is not Delete with a side effect. Its fixed order is:

1. materialize and serialize the same clip Copy would produce;
2. await `SelectionClipboardStore.write()`;
3. only after success, apply the rung-specific removal as one history entry;
4. re-resolve or relax the selection by the existing presence rule.

A failed write leaves the document byte-identical. Tests use a rejecting memory
store to make this a permanent contract.

Removal follows the rung:

| Selection | Cut removal |
|---|---|
| notes | remove those chord members; an emptied event becomes an equal-duration rest |
| events | clear to equal-duration rests, preserving the selected metric span |
| containers | replace timed containers with exactly equal-span silence; remove zero-time grace material. Refuse if an exact replacement cannot be represented |
| voice bars | remove the selected sequences; absence is silence for that voice |
| staff bars | remove selected staff sequences and declarations without touching other staves |
| whole part closure | remove the part and repair layout/presentation references conservatively |
| measures | remove the global columns and every part copy, closing the timeline and rewriting surviving measure references |
| sections | remove the complete named measure ranges, not merely their labels |
| score | unavailable: deleting a document belongs to its repository/library surface, not the edit session |

This is intentionally stronger authority than ordinary Delete, whose guarded
rules prevent hidden ink loss. Cut has first captured the material and remains
undoable, but it still refuses any transformation whose duration/reference
repair cannot be proven exact.

## Input, traces and ownership

Ctrl+C, Ctrl+X and Ctrl+V join the declarative key tables and cheatsheet. They
obey the existing editor-focus predicate; an unfocused embed or workbench must
not consume its host's clipboard shortcuts.

Copy is a read plus a store write and does not enter document history. Cut and
paste cross an environment boundary, so stage 1 resolves them before the
deterministic session mutation:

- Cut captures the clip and confirms its write, then records the resolved cut
  intent against the current selection.
- Paste reads and decodes first, then gives the session a resolved clip or
  `PastePlan`; trace replay must never consult whatever happens to be in the
  clipboard later.

Trace fixtures therefore record enough materialized paste data to replay the
edit deterministically. They do not record `paste` as a context-dependent verb
whose meaning lives outside the fixture. Large fixtures may reference a
committed clip fixture by content hash, but the hash must resolve inside the
repo and never into application state.

The memory store belongs to the workbench/app controller, not `EditorSession`
and not an individual scenario page. Closing the application clears it by
design in this stage; switching documents, routes or sessions does not.

## Implementation sequence

1. **Clip contract and transport seam.** Add the discriminated union, strict
   JSON codec/upgrader, `SelectionClipboardStore` and string-only memory store.
   Instantiate the store above document/session lifetime.
2. **Pure extraction.** Materialize point/range/closure clips at every rung,
   including structural-closure checks, dependency collection and detached-
   reference reporting. No mutation or UI in this stage.
3. **Pure paste planner.** Validate destination compatibility, allocate an id
   rewrite map, merge permitted dependencies and return either one complete
   plan or a typed refusal.
4. **Atomic paste.** Add the semantic paste op/batch, history and trace support,
   selection landing, undo/redo restoration and cross-document wiring.
5. **Cut removal.** Implement the rung table bottom-up, with exact-duration and
   reference-repair helpers shared with paste. Keep score cut unavailable.
6. **Bindings and feedback.** Add Ctrl+C/X/V through the keymap, focus gate and
   cheatsheet; report clip kind/member count, detached references and precise
   refusals without adding a parallel clipboard panel.
7. **Hands-on cross-score review.** Copy and cut each rung from one score,
   navigate to another score without reloading, paste into compatible and
   incompatible targets, then undo/redo in both source and target sessions.

Stages 1–3 should land before any mutation surface. A clip contract proven by
round-trip tests is cheaper to revise than document history containing an
underspecified paste.

## Evidence when it lands

- Codec round trips and strict rejection for unknown format/version/kind.
- Extraction fixtures for every rung: point, reversed range and Ctrl+A closure;
  rests, nested containers, multiple voices/staves/parts and empty bar copies.
- Partial-container refusals and internal/cross-boundary reference cases for
  ties, slurs, beams, techniques and measure-id references.
- Paste matrices covering every permitted and refused source/destination pair,
  id uniqueness, dependency merge and destination-context precedence.
- Empty-document acceptance for part and score clips; cross-score acceptance
  for every other compatible clip.
- Cut-write failure proving the source is unchanged, plus one undo/redo entry
  for every successful cut and paste.
- Trace replay whose result does not depend on current clipboard contents.
- Keymap↔documentation joins and focus-scope tests for Ctrl+C/X/V.
- Published MNX and `_x.mnxLab` validation after every accepted paste.
- `npm run update:primitives` remains byte-clean: the feature changes documents
  through editor operations, not layout or existing corpus goldens.

## Deferred explicitly

- System/OS clipboard reads, writes, permissions, formats and lifecycle.
- Clipboard persistence across application reload or shutdown.
- Paste special (pitch only, rhythm only, markings, lyrics, fingering, etc.).
- Merge-into-chord, repeat-to-fill, rhythmic fit, arbitrary tiling and insert
  time below the global-measure rung.
- Cross-score part/staff/voice mapping UI beyond exact compatible targets.
- Clipboard history, multiple slots or a visible clipboard manager.
- Mouse selection parity; this consumes `SelectionState` regardless of how it
  was produced.

The serialized, asynchronous `SelectionClipboardStore` boundary is the only
concession to a future transport. Reversing the internal-only decision later
means supplying another store implementation; clip extraction, validation,
paste planning, cut ordering, history and trace semantics stay unchanged.
