<!-- Split out of CLAUDE.md; CLAUDE.md links here and keeps the rules that
     must hold in every session. Paths in prose are repo-root-relative. -->

# Rendering (custom SMuFL/SVG engine)

Pipeline: layout → primitives → SVG. `src/engine/layout/{notation,tab}.ts` are pure
functions emitting staff-space primitives; `src/engine/render/svg.ts` is the dumb
emitter. **All horizontal spacing** lives in `src/engine/layout/spacing.ts` (springs-
and-rods; tune the named knobs, never per-renderer grid math) — both layouts consume one
plan so notation and tab stay column-aligned. The `both` view is **one native system**:
`layoutNotation({includeTabStaves: true})` (seam: `src/engine/layout/bothSystem.ts`)
draws each tab-bearing part's tab staff inside the same system walk — shared barlines,
interleaved multi-system wrap, columns aligned by shared plan slots. Tab-staff emission
(lines/clef/timesig/frets) lives ONCE in `src/engine/layout/tabStaff.ts`, used by both
the standalone tab layout and the native staff — extend it there, never fork it. See
[roadmap/complete/core-both-view-single-system.md](../roadmap/complete/core-both-view-single-system.md). Tuplets and grace notes draw on tab
too: containers are walked from `spacing.ts`'s own column widths so both staves stay in
column, grace digits are small (0.6), and a tuplet bracket is drawn **once per system** —
the standalone tab view draws its own, the `both` view lets the notation staff carry it
(`showTupletBrackets`). Fret/string assignment uses
the derivation ladder in `src/engine/tab/guitarPositions.ts` (MNX pitch is
sounding): an annotated `_x.mnxLab.string` derives its fret against the declared
`strings[]` + capo (a stored `fret` is validation-only — a mismatch renders the
derived fret plus a red badge), bare notes get the lowest-playable-fret
assignment, and unplayable notes draw nothing plus a red `scope: 'tab'` badge —
never a silent clamp. **No instrument is assumed**: absent `strings[]` means no
fingerboard (the shim materializes standard into older tab documents); a viewer
override (`TabSetup`) may supply strings/capo as presentation. Layouts render **forgivingly**:
unsupported content degrades to a placeholder and per-measure "!" badges
(`src/engine/layout/diagnostics.ts`) — red = user-fixable error, blue = warning, amber =
renderer gap. `ValidationIssue.scope: 'tab'` marks fingerboard-only constraints (the
notation renderer drops them; severity matters — a warning must not read as "you made a
mistake", and the schema validators must never see these). Everything renders into
shadow DOM. Do **not** reintroduce VexFlow or any notation library. The note↔JSON
cross-highlight depends on `model/noteKeys.ts` and `model/jsonView.ts` mirroring the
same traversal — keep them in lockstep.
