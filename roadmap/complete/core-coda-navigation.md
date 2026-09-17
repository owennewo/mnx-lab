# Coda navigation — preserve, engrave and perform the vocabulary real scores use

**Status:** complete 2026-09-17. **Player campaign item 20.** Raised by the cached Soundslice
export of the Beatles' *Blackbird*, whose eight GPIF master-bar `Directions` survive in
the canonical `.gp` but are all deliberately reported as unrepresented by
`guitarpro-mnx`.

## The observed failure

The cache is not the lossy boundary. The `.gp` contains:

| Bar | GPIF direction | Printed meaning |
|---:|---|---|
| 3 | `Target SegnoSegno` | double segno |
| 9 | `Jump DaDoubleCoda` | To Double Coda |
| 14 | `Target Segno` | segno |
| 18 | `Jump DaCoda` | To Coda |
| 26 | `Jump DaSegnoAlCoda` | D.S. al Coda |
| 27 | `Target Coda` | coda |
| 33 | `Jump DaSegnoSegnoAlDoubleCoda` | D.S.S. al Double Coda |
| 34 | `Target DoubleCoda` | double coda |

`converters/guitarpro-mnx/src/gpif/document.ts` does not parse `Directions`; the
unrecognised-child tripwire consequently emits one accurate warning and the converted
document contains none of the marks. Published MNX cannot carry the missing data anyway:
`jump-type` is only `segno | dsalfine`, a global measure can hold one `segno` and one
`fine`, and there is no coda or D.C. object. The latest upstream schema checked on
2026-09-17 is unchanged in this area.

This item closes the real-source gap without claiming that private vocabulary is
published MNX.

Implementation evidence is registered in the standing verification ledger:
[Coda and double-coda navigation](../inprogress/lab-verify.md#coda-and-double-coda-navigation--2026-09-17).

## Agreement

### Oracle

*Blackbird* is the implementation-time end-to-end oracle: import the canonical cached
`.gp`, assert that all eight directions survive in the normalized document, inspect the
notation and tab engravings against the cached MusicXML/Soundslice result, and state the
performed bar order independently before changing traversal.

The private/copyrighted score is **not committed** and is not a permanent gate. Before
the item lands, distil its direction sequence into:

- a minimal synthetic GPIF fixture exercising every source token above;
- a local navigation scenario with the corresponding normalized MNX objects and
  notation/tab/unrolled goldens; and
- hand-stated traversal expectations that cannot pass merely because import and export
  share the same mistake.

The fixture proves conversion losslessness; primitives prove visible content and
placement; the explicit performed order proves semantics. A round trip alone proves none
of those independently.

### MNX verdict

This is a genuine published-schema gap. `spec/mnx-schema.json` remains a verbatim upstream
copy and `MnxGlobalMeasure.jump.type` continues to describe only published MNX.
Unadopted navigation lives at `global.measures[i]._x.mnxLab.navigation`, is validated by
`spec/mnx-lab-extensions.schema.json`, and becomes the `navigation` proposal topic if it
is packaged upstream.

The extension is shaped for wrapper deletion on adoption, not after GPIF spellings:

```jsonc
{
  "_x": {
    "mnxLab": {
      "navigation": {
        "marks": [
          {
            "id": "double-coda",
            "kind": "coda",
            "count": 2,
            "location": { "fraction": [0, 1] }
          }
        ],
        "jumps": [
          {
            "type": "toCoda",
            "target": "double-coda",
            "text": "To Double Coda",
            "location": { "fraction": [0, 1] }
          }
        ]
      }
    }
  }
}
```

`marks` and `jumps` are arrays because MusicXML permits several direction types at one
location and GPIF represents a double sign as a distinct target. `kind` identifies the
musical object (`segno | coda`); `count` identifies the single/double printed and semantic
target without multiplying the vocabulary into `segno`, `doubleSegno`, `coda`,
`doubleCoda`. IDs make two same-kind targets unambiguous. `text` preserves the source's
literal caption while structured fields drive engraving and traversal.

The implementation must settle and document the reference fields for compound
instructions. At minimum, `toCoda` names its coda target; a `dalSegnoAlCoda` instruction
names both the segno it returns to and the coda at which normal reading resumes. “Double”
is expressed by which mark is referenced, not by a second jump type.

### Published and lab enums stay visibly separate

Do not append private values to the published alias. Define two disjoint literal enums
and let only the normalized consumer type be their union:

```ts
export const MNX_JUMP_TYPES = ['segno', 'dsalfine'] as const;
export type MnxJumpType = typeof MNX_JUMP_TYPES[number];

export const MNX_LAB_JUMP_TYPES = [
  'toCoda',
  'daCapo',
  'daCapoAlFine',
  'daCapoAlCoda',
  'dalSegno',
  'dalSegnoAlFine',
  'dalSegnoAlCoda'
] as const;
export type MnxLabJumpType = typeof MNX_LAB_JUMP_TYPES[number];

export type NavigationJumpType = MnxJumpType | MnxLabJumpType;
```

The extension schema defines only `MnxLabJumpType`; the standard field continues to use
`MnxJumpType`. A test requires the lists to be disjoint. If upstream adopts a value, the
migration is mechanically visible: move it from the lab list to the published list,
update the pin/schema, migrate the wrapper, and let the disjointness and corpus tests
catch any incomplete retirement.

The list above is semantic, not a promise to mirror every Guitar Pro token one-for-one.
The parser owns the source-token table. In particular, double segno/double coda select a
different referenced mark; they do not create `dalDoubleSegnoAlDoubleCoda` as another
internal behavior. The lab `dalSegno` and `dalSegnoAlFine` values are used only when the
jump must name an explicit target (notably a double segno); ordinary single-sign forms
remain the published `segno` and `dsalfine` objects.

### Dependency and storage budget

No runtime dependency. The library continues to store the Soundslice `.gp` as canonical
source and converts on read; this item does not turn derived MNX into the service's source
of truth. Exported documents remain published MNX because all additional objects live
under the standard `_x` hook.

## Implementation sequence

1. **Inventory and normalization.** Parse GPIF `Directions` into typed target/jump tokens;
   keep the unrecognised warning for genuinely unknown values. Establish the complete
   token table from the clean-room field evidence, not only the eight Blackbird values.
2. **Extension contract.** Add the navigation definitions to
   `mnx-lab-extensions.schema.json`, bump its additive minor version, add matching model
   and converter-common types, and test published/lab enum disjointness. Update the
   extension register and converter matrix inputs.
3. **Conversion.** Map known GPIF tokens to structured marks/jumps, resolve forward target
   references after all master bars are known, and write them back on GP export where the
   target vocabulary has an exact representation. Unknown or unrepresentable cases warn
   with measure and literal token; nothing silently disappears.
4. **One consumer view.** Normalize published `segno`/`fine`/`jump` and lab navigation into
   one read-only model helper. Engine, audio and edit code consume that helper rather than
   each growing its own published-versus-lab branch.
5. **Engraving.** Draw coda signs with SMuFL `coda`; draw `count: 2` as two signs with
   ink-priced separation; render the literal jump caption when present and a conventional
   generated caption otherwise. Use the existing navigation skyline in `scoreText.ts` in
   notation, tab and both views.
6. **Traversal.** Extend `model/passes.ts` only after hand-stating Blackbird's performed
   order. Specify arming of To Coda, which repeats are retaken after D.C./D.S., what happens
   when a target is absent or ambiguous, and how partial-measure locations bound entries.
   Unsupported or contradictory graphs diagnose and fall back deterministically; they do
   not loop until the traversal cap.
7. **Editing and inspection.** Make every new mark/jump addressable and destructible through
   the existing measure-attribute mechanism. Creation UI is not required for the first
   slice, but JSON and rung inspection must not hide the objects.
8. **Durable evidence and review.** Commit the synthetic converter fixture and corpus
   scenario, regenerate the converter matrix and affected goldens, register any moved
   goldens in `lab-verify.md`, and review Blackbird locally as the final end-to-end check.

## Acceptance

- Importing cached Blackbird produces no `master bar <Directions> is not represented`
  warning and preserves all eight known instructions with their single/double identity.
- The committed synthetic GPIF fixture proves every source token maps to the intended
  structured object; exact GPIF round trips preserve every representable token.
- Published-only navigation still validates against `spec/mnx-schema.json`; extended
  navigation validates as published MNX plus `_x.mnxLab`, without widening the official
  `jump-type` definition.
- Notation, tab and both layouts render single/double segno and coda signs plus all jump
  captions without collisions at system starts, endings or barlines.
- Hand-stated traversal cases cover D.C., D.S., Fine, Coda and Double Coda, including
  missing/duplicate targets and traversal-cap safety.
- The renderer, traversal and editor use one normalized navigation helper; no consumer
  parses GPIF names or printed text.
- Blackbird is manually inspected from the cache during implementation, but no copyrighted
  source bytes, title-specific branch or dependency on `/home/.../soundslice-cli` lands in
  the repository.

## Explicitly out of scope

- Claiming these objects are already standard MNX.
- Solving arbitrary repeat graphs beyond the source vocabulary and stated traversal rules.
- General formatted text or typography; `text` is source fidelity for a typed instruction.
- Committing Blackbird or using its title as converter logic.
- Posting the upstream proposal. This item produces a proposal-ready schema shape and
  evidence bundle; publication remains a deliberate spec-loop action.

## Outcome

Landed in `36b4d3c`. The converter now preserves and exactly round-trips all 19 known
GPIF direction tokens. Published and lab jump enums remain separate and meet only in the
normalized navigation view used by engraving, traversal and editing. Cached *Blackbird*
imported without a Directions warning, rendered all eight marks/instructions on notation
and tab, and traversed its 58 performed entries without diagnostics. The private score
was not committed; the durable oracle is the synthetic eight-bar scenario and its
hand-stated route. The new golden batch remains queued for human review in
`lab-verify.md`.
