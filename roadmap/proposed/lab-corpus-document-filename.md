# The corpus fixture is a document — `score.mnx.json` → `document.mnx.json`

> **Status: proposed (2026-08-30).** Serves the **implementation loop** by changing **lab
> machinery**, not MNX data. Follows the vocabulary settled by
> [core-document-rung.md](../complete/core-document-rung.md) and the public element rename in
> [core-document-viewer-rename.md](../complete/core-document-viewer-rename.md). Kept separate because
> `scenarios/spec/` is generator-owned, 119 paths move, and the corpus/goldens require a
> stronger diff verdict than a class rename.

## The file names the wrong thing

Every scenario contains one root MNX document, currently stored as `score.mnx.json`. That
root may contain zero, one or several members of `scores[]`; measured when this proposal was
raised, the corpus has **119 scenario documents**, while most have no `scores[]` at all.
The filename therefore has the same collision the selection ladder already removed and the
public viewer still carries: it calls the whole document by the name of one optional
presentation inside it.

The target corpus shape is:

```
<scenario>/
├─ meta.json
├─ document.mnx.json
├─ expected.primitives.json   optional
├─ expected.svg               optional
├─ expected.tab.svg           optional
├─ expected.both.svg          optional
└─ notes.md                   optional
```

This is a repository convention only. It does not change MNX's preferred interchange
extensions (`.mnx.json`, with `.json`/`.mnx` accepted on read), the contents of a document,
or the `scores[]` vocabulary inside it.

## Ownership makes the order load-bearing

`scenarios/spec/` is a mirror owned wholesale by `npm run sync:spec`; hand-renaming files in
that tree would violate the same rule as editing a mirrored example's notes. The migration
therefore begins at its writers:

1. Change `spec/tools/sync-spec-examples.mjs` to emit `document.mnx.json`.
2. Change scenario discovery and `harness/verify/check-scenarios.mjs` atomically so the new
   file is required and the old file is rejected.
3. Regenerate the mirrored tree through `npm run sync:spec`; never `git mv` its files by
   hand.
4. Rename the locally owned `scenarios/lab/` files with normal git moves.

The check is deliberately strict rather than accepting both names. A dual-name transition
would allow half-migrated scenarios indefinitely, and two JSON roots in one directory make
it ambiguous which document the goldens judge. The branch is the migration boundary: old
before it, new after it.

## Consumers that move

Measured when raised, **36 active files** mention `score.mnx.json`. The paths cover several
distinct jobs and all must move together:

- `src/corpus/corpus.ts`: `scoreModules`, `scorePath` and `ScenarioEntry.loadScore` become
  `documentModules`, `documentPath` and `loadDocument`;
- `src/workbench/ScenarioPage.ts`: `loadScore`, `rawScore` and transport diagnostics become
  document vocabulary;
- `harness/verify/check-scenarios.mjs`: the allowed-file set, missing-file diagnostic and
  JSON verdict target;
- corpus-wide conformance helpers and direct fixture reads;
- `harness/render/render-png.ts`, library/embed smoke fixtures and usage copy;
- `spec/tools/push-proposal.mjs` and `sync-spec-examples.mjs` — both directions of the spec
  loop must agree on the local filename;
- converter documentation and repository guidance (`AGENTS.md`, current README/docs).

Variables local to a real MNX `scores[]` walk do **not** move. The rename ends at the file's
root boundary; it must not turn `MnxScore` or a `scoreIndex` into “document”.

## The diff contract

This item should produce a large path diff and a tiny semantic diff:

- every scenario has exactly one `document.mnx.json` and no `score.mnx.json`;
- JSON bytes are unchanged across each rename;
- no `meta.json` `status` or `verification` block changes;
- no `expected.*` file changes;
- manifest ids, scenario ids and lazy-chunk behavior are unchanged;
- proposal bundles still inject the same document bytes upstream — only their local source
  path changes.

Git may display some regenerated mirrored files as delete/add rather than rename; the
verdict is byte identity by scenario id, not rename-detection cosmetics. Capture a before
map of `scenario id → document hash` and compare it after regeneration so the ownership-
correct route has a machine check stronger than visual diff inspection.

## Work

1. Add a small read-only hash/check helper or extend the migration test to snapshot every
   current scenario id and root JSON digest before the path move.
2. Update the sync writer, corpus police, runtime discovery and spec proposal tooling to the
   new filename and vocabulary.
3. Regenerate `scenarios/spec/`; move `scenarios/lab/`; update every direct harness and app
   fixture path.
4. Update current repository/converter documentation. Historical roadmap references to the
   old convention remain historical unless they are also acting as present-day instructions.
5. Compare the before/after id→hash map, then run the corpus and build gates.

## Acceptance

- `find scenarios -name score.mnx.json` returns zero and every scenario directory contains
  exactly one `document.mnx.json`.
- The before/after document hashes agree for all 119 scenario ids; additions or removals are
  a failure, not migration noise.
- `npm run sync:spec` is idempotent and leaves the regenerated `scenarios/spec/` tree clean.
- After `npm run update:primitives`,
  `git diff --name-only -- scenarios | rg '/(expected\..*|meta\.json)$'` returns no paths:
  no golden, status or verification file moves alongside the root-file renames.
- `npm test`, every converter workspace test affected by fixture documentation/helpers,
  `npm run check:scenarios`, `npm run build`, `npm run build:lib`, `npm run build:embed` and
  `npm run smoke:lib` / `npm run smoke:embed` are green.

## Not this

- Not a document format conversion or MNX schema change.
- Not a scenario id/category rename and not a golden regeneration event.
- Not `score` → `document` inside genuine MNX presentation types, operations or grammar.
- Not a compatibility period with two accepted corpus filenames. The corpus is one atomic,
  committed format, and the migration should finish in one branch.
