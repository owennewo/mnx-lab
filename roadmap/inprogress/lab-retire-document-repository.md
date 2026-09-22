# Retire the unused document repository client

**Status:** in progress, 2026-09-22.
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
