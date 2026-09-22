# Current documentation consistency

Implementation loop. Complete 2026-09-22; requested as maintenance item 4.

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

## Implementation and validation

Corrected converter guarantees against the storage register, Studio's shipped editor
and Lit framework, the moved navigation link, and optional workbench library access.
Root tests now check current reference destinations, including inline/image links and
reference definitions, with code examples, remote URLs and heading anchors excluded.
The checker does not crawl linked roadmap documents or validate heading fragments.
Three focused tests pass. On the final rebased tree, root tests passed (145 files,
2602 tests passed, 1 skipped) and the full build passed. Primitives regeneration passed
194 tests with a clean scenarios diff. No runtime or renderer changes; browser smokes
were unnecessary. Landed through b32af332; worktree retired before this completion.
