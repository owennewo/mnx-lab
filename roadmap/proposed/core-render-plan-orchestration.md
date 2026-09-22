# Shared render-plan orchestration

Implementation loop. Proposed 2026-09-22; requested in the maintenance review.

## Problem

Notation, tab and combined renderers repeat square-layout caching, viewport fitting,
absolute staff scaling, ink-ratio relayout, cropping and outcome construction. A change
to those contracts currently requires three coordinated edits.

## Scope

Extract one DOM-free orchestration function and common renderer options, retaining the
three public entry points and their view-specific layout arguments. Preserve selected
rest events for notation/both and instrument overrides for tab/both. Keep cache ownership
with the caller and leave engraving algorithms and cache lifecycle unchanged.

## Acceptance

- Fitted, explicitly scaled, natural-spacing and non-square plans retain their behavior
  in all three views; cached and uncached gestures agree.
- Regenerate primitives and require a clean scenarios diff: no golden or verification
  changes are expected.
- Run focused plan/zoom/density tests, then final rebased full tests/build and relevant
  browser smoke checks before the serialized fast-forward landing.
