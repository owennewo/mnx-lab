# Retire the unused document repository client

**Status:** complete, 2026-09-22.
**Loop:** implementation — repository maintenance; no schema or engraving changes.

## Problem

`src/storage/cloudRepository.ts` and `repository.ts` reserve a typed client for
`/api/documents`, which still returns 501. They have no consumers or public library
exports. Studio now persists source renditions through the library client and
`saveSession`; keeping a second, unused persistence abstraction misstates the current
architecture.

## Scope

- Verify references and public exports, then remove the unused client and interface.
- Correct their current references in `docs/workbench.md` and the documents route comment.
- Preserve `/api/documents` and `/api/auth` as reserved 501 routes; their removal would
  be a separate compatibility decision. Preserve historical roadmap prose.

## Acceptance

No production imports or exports depend on the retired modules. Current documentation
identifies Studio's library/save-session path. The existing full `npm test` and
`npm run build` gates pass on the final rebased tree. No browser behavior changes,
new tests, converter changes, or golden regeneration are expected from this removal.

## Outcome and validation

Removed both unused modules after confirming no production consumers or public
exports. Updated the current workbench guide and documents-route comments to name
Studio's library/save-session path; the reserved HTTP responses are unchanged.

After rebasing on the renderer and architecture maintenance changes, regenerated
primitives (194 passed) with a clean `scenarios/` diff. Final gates: `npm test`
passed 143 files, 2,590 tests (one skipped); `npm run build` passed. No shell,
element, converter, or live persistence behavior changed. Implementation landed as
`67f26e28`; the worktree and branch were removed before this completion record.
