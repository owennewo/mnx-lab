# Module specs

These are the **Tier-3, just-in-time** specs. Each is the detailed "how" for one package —
its public API, internal structure, edge cases, and tests. By rule (see `clean-room-plan.md`):

- A spec here may **not** be written until that module's contract exists in `../superseded/02-architecture.md`.
- A spec is written **only when we're about to build that module**, so detail can't go stale.

## Planned specs

| Spec | Package | Contract | Status |
|------|---------|----------|--------|
| `mnx-core.md` | `mnx-core` | C1 | **next** (Phase 0) |
| `mnx-scenarios.md` | `mnx-scenarios` | C6 | **next** (Phase 0) — but mostly specified already in `../inprogress/04-scenario-library.md` |
| `mnx-render.md` | `mnx-render` | C2 | **soon** (Phase 2, the beachhead) |
| `gallery.md` | `gallery` | composes C1/C2/C6 | Phase 1–2 |
| `mnx-audio.md` | `mnx-audio` | C3 | later (Phase 5) |
| `editor-app.md` | `editor-app` | composes + storage | later (Phase 6) |
| `mnx-ai.md` | `mnx-ai` | C5 | **last** (Phase 7) |
| `mnx-convert.md` | `mnx-convert` | C4 | anytime, standalone |

Each spec, when written, follows the same skeleton: **Purpose → Public API (the contract,
verbatim from architecture) → Internal structure → Key algorithms / edge cases → What it must
NOT do → Tests → Seeds (which existing docs/code to mine).**
