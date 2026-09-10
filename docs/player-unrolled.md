# Unrolled engraving

Implementation loop, player campaign item 10. The **Unrolled** checkbox in the
score settings shows performed order in notation, tab or both. It is a
per-browser preference (localStorage `mnx-lab.unrolled`), independent of the staff
view and of the URL's initial playback `at` ordinal. It is
presentation state: the document and its written IDs never change.

`<mnx-document-viewer unrolled>` exposes the same behavior to embed hosts. All SVG
adapters and pure layouts accept `entries?: PerformedEntry[]`; `engravingEntries`
resolves the toggle once from the shared traversal. Omission preserves written
engraving byte-for-byte. There is no new runtime dependency.

## Geometry and identity

The horizontal planner resolves inherited clef, key and meter in written order,
then gives every visit independent metrics and a `MeasurePlan.entry`. Packing
indexes refer to geometry; `entry.measureIndex` refers to written content. A jump
therefore restores the target's written state. Every emission pass reads the
written content through that mapping. Beams, slurs, ties, technique targets,
ottavas and hairpins resolve separate occurrence geometry. Ordinary references
stop at traversal jumps; a `crossJump` tie joins only an actual adjacent jump pair.

Repeat signs, navigation signs and ending brackets disappear. Written bar numbers
remain, and visits from occurrence two onward carry `2×`, `3×`, etc. Occurrence
counts are independent of strain iteration. Written layout breaks and multirest
collapses are ignored with diagnostics; when a score changes staff layouts, its
first layout supplies the unrolled presentation and the ignored layout constraint
is badged.

Occurrence ink carries `sourceId = w<ordinal>:<noteKey>` and `writtenSourceId`.
The SVG exposes both as `data-source-id` and `data-written-source-id`. Written IDs
remain opaque outside unrolled mode. Click events expose the written `noteId`
and the exact `ordinal`; playback highlights/reveals only that visit. Selection
still belongs to the written note and lights every visible copy, with separate
selection enclosures. `buildJsonView(doc, entries)` maps occurrence IDs to the
same written JSON lines without changing the text or reverse written selection.

Partial entries draw the whole written bar with a diagnostic. Notes outside the
half-open slice have an `unperformed` class, opacity and a tooltip, and have no
activation index entry. Playback cannot highlight or reveal them. A note crossing
a bound remains performed with clipped playback time. Metric membership shares
exact rational arithmetic with the compiler (`model/time.ts`; the existing
`audio/time.ts` export remains compatible). Grace notes at an ending boundary
follow the compiler's steal-previous convention. Unsupported container geometry
continues to carry renderer diagnostics; a visible note is not automatically a
performed note.

## Evidence and review

Sixteen hand-stated cases opt in with `unrolled: true`: the original fourteen
navigation cases plus the later coloured-clef and partial D.S./ending regressions.
`harness/verify/unrolled-evidence.mjs` lists their exact IDs. They carry
`expected.unrolled.svg`; the two tab-opting cases also carry
`expected.unrolled.tab.svg`. `npm run update:primitives` regenerates these through
the same real SVG emitter as the written goldens.

`unrolledHash` and `unrolledAt` are independent approval provenance. New output is
unseen even when written engraving is approved. Missing required output blocks
review; changed approved output is stale. Neither regeneration nor written-only
approval stamps this hash. The existing verification writer owns all status and
approval changes, preserving unrelated records.

`node harness/verify/unrolled-review.mjs` produces a self-contained side-by-side
page and an exact presentation receipt in `dist/review/`. The generator refuses
outdated unrolled goldens. `/verify` presents this evidence before recording an
explicit unrolled verdict with the receipt. The work remains in the standing
[review ledger](../roadmap/inprogress/lab-verify.md#unrolled-engraving--2026-09-09);
automated tests and visual inspection do not grant approval.

`npm run smoke:unrolled` builds the app and review page, then checks URL state,
toggling, exact-occurrence seeking, all-copy selection, playback without
relayout, excluded partial-note activation/reveal, and review completeness in
headless Chrome. Conformance tests join rendered occurrences to compiler output
and written JSON identity, and exercise target-state restoration, independent
curves, partial slices and ignored layout constraints.
