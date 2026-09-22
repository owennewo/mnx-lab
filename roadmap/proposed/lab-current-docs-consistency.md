# Current documentation consistency

Implementation loop. Proposed 2026-09-22; requested as maintenance item 4.

## Problem and scope

Current documentation overstates converter round-trip guarantees and describes Studio
editing and its framework as future decisions. A moved navigation roadmap breaks a link.
Correct README.md, CLAUDE.md, apps/studio/README.md and connected current docs against
shipped code and the committed round-trip register. Preserve historical roadmap prose.

Add a bounded local Markdown destination checker for these current reference surfaces
(root README/CLAUDE, docs/**/*.md, Studio README), exercised by root tests. Check file
existence, not remote URLs or heading anchors; do not sweep historical roadmap archives.

## Acceptance

- Capability claims distinguish reference fixtures from corpus-wide conversion limits.
- Studio documentation describes Lit, the shared editor binding and touch playback rule.
- Current reference file links resolve and behavior tests cover missing and ignored links.
- Full root tests and build pass before landing; no rendering or runtime changes.
