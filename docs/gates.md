<!-- Split out of CLAUDE.md; CLAUDE.md links here and keeps the rule that must
     hold in every session. Paths in prose are repo-root-relative. -->

# The landing gate: what a diff reaches

`npm run gate` (`tools/gate.mjs`) is landing step 5. It lists what the branch changed
since it left `origin/main` — committed, uncommitted and untracked — and runs what those
paths can reach. `--plan` prints the plan and the reasons and stops; `--full` runs
everything regardless. The rule is `planGate()`, pure and pinned by
`harness/conformance/gate-plan.test.ts`.

## The rule

| the diff touches | tests | build | smokes |
|---|---|---|---|
| only prose, plans, agent config (`roadmap/`, `research/`, `.claude/`, `*.md`) | none | none | none |
| prose a test reads (`docs/`, `README.md`, `CLAUDE.md`) | the link and keymap checks | none | none |
| data read from disk (below) | **all** (`npm test`) | yes | by area |
| code (`src/`, `apps/`, `worker/`, `converters/`, `harness/`, `tools/`, `experiments/`) | what imports it (`vitest --changed`) + the source readers | yes | by area |
| anything else | **all** | yes | **all** |

**Data read from disk** runs every test because vitest's import graph cannot see it:
`scenarios/`, `public/`, `migrations/`, `spec/`, `vendor/`, `harness/{fixtures,reports,musicxml-oracle}/`,
`converters/fixtures/`, `worker/generated/`, `worker/models*.json`, `package*.json`,
`tsconfig*.json`, `*.config.ts`, `wrangler.jsonc`, `.dependency-cruiser.cjs`, the three
HTML entry pages, and `docs/studio-storage.md` (two library tests read it).

**The source readers** are tests that read source files from disk instead of importing
them, so an import graph never selects them: `architecture-boundaries`,
`audio-boundary`, `musicxml-independent`, `rung-inspector`, `converter-matrix`, `roster`.
They run with any code change.

**Converter suites** run when their package changes, and both run when `src/model/` or
`converters/fixtures/` does (the shared model contract).

**Smokes by area.** Each smoke declares `covers` in `harness/verify/run-smokes.mjs`:
the shell it drives (`workbench`, `studio`), `library` when it runs the Worker, or the
face it loads (`embed`, `lib`, `audio`). A path maps to areas: `src/workbench/` →
`workbench`; `apps/studio/` → `studio`; `worker/`, `migrations/` → `library`;
`scenarios/` → `workbench` (the corpus is bundled into it); a smoke's own file → that
smoke. Shared `src/` layers, `public/`, the converters, root configs and the shared
smoke plumbing (`harness/verify/`, `harness/browser/`) reach every smoke.

## Why it is shaped this way (2026-09-24)

Measured before it existed (`lab-faster-gates`): a full landing gate on a 6-core machine
was `npm test` ~39–65 s, `npm run build` ~15–25 s and every smoke ~55 s four at once —
and every agent's gates share those six cores. Replaying this rule over main's last 60
commits: 15% were prose and run in about two seconds; 38% were code, where
`vitest --changed` picks a median of one test file (13 of 23 picked none) plus the
source readers; 47% touched data and still run the whole suite. The worked examples:
a docs edit gates in ~2 s, a studio-only edit in ~52 s (12 of 24 smokes), a full gate
~165 s.

**Why not vitest's import graph alone.** Probed file by file, `vitest --changed`
selected **no** test for a changed golden (`expected.primitives.json`), the SMuFL
metadata, a migration, the round-trip register or a converter fixture — 81 of 153 test
files read the filesystem, and the graph sees none of it. Hence the data list: it is
the list of what tests read from disk, and it fails safe.

**Why an unknown path runs everything.** A new top-level directory or root file is
exactly the change the rule has never been asked about. Running everything costs one
slow gate; a wrong "none" costs a red `main` for every other agent.

## Keeping it honest

- A new test that reads a path from disk: if the path is not already data or prose the
  test reads, add it to `DATA` in `tools/gate.mjs`. If it reads **source**, add it to
  `SOURCE_READERS`.
- A new smoke declares `covers`; a new shell or face adds its area and its path rule.
- A new top-level directory is unknown — and runs everything — until it is classified.
- When in doubt, `npm run gate -- --full`. The gate narrows the work; it never
  replaces judgement about what a change could break.
