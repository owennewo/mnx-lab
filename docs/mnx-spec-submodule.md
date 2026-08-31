# The MNX spec submodule (`vendor/mnx`)

The W3C Music Notation CG develops MNX at **[github.com/w3c-cg/mnx](https://github.com/w3c-cg/mnx)**
(rendered at [w3c-cg.github.io/mnx/docs/](https://w3c-cg.github.io/mnx/docs/)). This repo
carries it as a git submodule at `vendor/mnx`, pinned to a specific commit.

```bash
git submodule update --init vendor/mnx     # after a fresh clone
```

The submodule is **dev-time only**. `npm run build` and the Cloudflare deploy must
never need it: `spec/mnx-schema.json` stays vendored (the Worker's validator is
compiled from it) and `scenarios/spec/` stays committed. The submodule is what those
are *generated from*, not what they are read from at build time.

## What we read out of it

Upstream's docs are database-driven — `doctools/data.json` is a Django fixture
(`freezedb` output) and everything under `docs/` is generated from it. So the sources
are records, not files:

| We want | Upstream source |
|---|---|
| Example documents (52 at the current pin) | `doctools/media/examples/json/*.json` via `exampledocument.document_path` |
| Reference engravings | `doctools/media/examples/*.png` via `exampledocument.image_url` |
| Titles + blurbs | `exampledocument.name` / `.blurb` |
| `coversDefs` | the `exampledocumentobject` join |
| Schema version | `xmlschema.version` — this is the number in `mnx-schema.json`'s `$id` |

[spec/tools/specSource.mjs](../spec/tools/specSource.mjs) resolves all of it;
[spec/tools/sync-spec-examples.mjs](../spec/tools/sync-spec-examples.mjs) (`npm run sync:spec`)
writes `scenarios/spec/`; the workbench's compare view and the `/verify` review page
read the engravings straight off disk (dev-only), so review works offline.

Three things worth knowing, all learned the hard way when this replaced HTML scraping:

- **Source documents carry `_x.mnxdocs`** — the doc generator's own vendor dict
  (`{highlight: [...]}`), telling the spec site which keys to emphasise — dozens of
  occurrences across the examples. It is presentation metadata, stripped on import by
  vendor key
  (not by dropping `_x` wholesale — same `_x.<vendor>` convention as our `_x.mnxLab`).
- **`blurb` is a string or an array of lines** — `freezedb` splits multi-line text
  fields into line arrays. Most examples have no blurb at all and get a synthetic
  description.
- **`coversDefs` is authoritative, not a guess.** `ExampleDocumentObject` is a derived
  cache built by `accumulate_used_json_objects()`, which walks each example's JSON
  against the schema's object graph. It is what drives the "examples using this object"
  list on every object page upstream.

## Prose drift

MNX's descriptions are **normative**, and `mnx-schema.json` drops all of them — so a
field can be redefined with no schema change whatsoever. This is not hypothetical: v24
reversed what `dynamic-group.value` means for an accent (see
[spec/HISTORY.md](../spec/HISTORY.md)) and separately documented a `type: 'accent'`
enum value that had been legal and unmentioned since v19. A schema diff shows neither.

`spec/spec-prose.json` fingerprints every documented object, relationship and enum
(663 items at the current pin, ~33 KB) — hashes, not text, so we report *which* items moved without copying
upstream's documentation into this repo. `npm run sync:spec` diffs against it, prints
what changed, and rewrites it, so the delta lands in the same commit as the pin move.

**A reworded description deserves a read, not a shrug.** The report tells you what moved;
the submodule has the wording.

## Moving the pin

The pin is a statement about *which spec revision the corpus was generated from*, so it
must always be an upstream commit. `npm run sync:spec` warns if `vendor/mnx` is on a
commit unreachable from `origin/main` — that means a proposal branch got left checked
out, and committing it would leave a submodule nobody else can fetch.

```bash
git -C vendor/mnx fetch origin
git -C vendor/mnx checkout <sha>
cp vendor/mnx/docs/mnx-schema.json spec/mnx-schema.json   # if the version changed
npm run compile-validator && npm run sync:spec && npm test
git add vendor/mnx spec/mnx-schema.json scenarios/spec
```

A schema bump can legitimately change render output, which demotes `verified` scenarios
back into the approval queue — that is the mechanism working, see
[roadmap/complete/lab-spec-approval.md](../roadmap/complete/lab-spec-approval.md).

## Contributing upstream

`.gitmodules` points at **upstream**, never at a fork — the pin has to be fetchable by
everyone. Add your fork as a second remote inside the checkout instead:

```bash
gh repo fork w3c-cg/mnx --clone=false
git -C vendor/mnx remote add fork git@github.com:<you>/mnx.git
```

Branch in the submodule, push to `fork`, PR fork → upstream, and leave the recorded pin
on an upstream commit throughout.

Process notes from their [CONTRIBUTING.md](https://github.com/w3c-cg/mnx/blob/main/CONTRIBUTING.md)
and [doctools/README.md](https://github.com/w3c-cg/mnx/blob/main/doctools/README.md):

- **Every PR needs an associated issue first.** Co-chairs triage and milestone it.
  (Their CONTRIBUTING says Pages builds from `master`; the default branch is actually
  `main`.)
- **This is a W3C CG report repo** (`w3c.json`, group 81249). Contributions need CG
  membership and a signed CLA — see
  [roadmap/proposed/low-priority/spec-mnx-cg-proposals.md](../roadmap/proposed/low-priority/spec-mnx-cg-proposals.md) §6.
- **You cannot hand-edit the spec.** Changes are made through the Django admin and
  serialized with `freezedb`; the PR carries `doctools/data.json` (plus, for a new
  example, its `.json` and `.png` — `freezedb` doesn't produce those). Don't regenerate
  `docs/` in a PR; maintainers do that.

### Proposing a spec change: the proposed-schema pattern

A bug fix can be described in an issue. A *design* proposal is only convincing if it has been
built, so this repo carries a second schema while one is in flight.

```
spec/mnx-schema.json            verbatim copy of the pinned upstream release — never edited
spec/mnx-schema.proposed.json   generated from our proposal branch — optional, transient
```

**Generating it**, from a proposal branch — **never checked out in `vendor/mnx`**. The
submodule is the *pin only* (always the upstream commit `sync:spec` reads); proposal
branches live in git **worktrees** beside the repo, so the pin and the proposal can never
double-duty (structure-lab). `pinIsUpstream` is thereby an assertion, not a load-bearing
guard:

```bash
git -C vendor/mnx worktree add ../../../mnx-proposals/<branch> <branch>
cd ../mnx-proposals/<branch>/doctools
uv run --python 3.12 --with django==4.2.24 --with lxml \
  --with git+https://github.com/w3c-cg/mnxdocgenerator.git \
  python manage.py makesite /tmp/proposed-site
cp /tmp/proposed-site/mnx-schema.json <repo>/spec/mnx-schema.proposed.json
```

Injecting a topic's scenarios + engravings into the branch fixture is mechanised:
`node spec/tools/push-proposal.mjs <topic>` upserts the `exampledocument` records,
media JSON, our engravings and the `coversDefs` joins directly into the worktree's
`doctools/data.json` (byte-stable freezedb layout, verified before writing; re-runs are
no-ops). `loaddb` → `freezedb` round-trips `data.json` byte-identically, so fixture-direct
writes and admin edits compose.

Bump `xmlschema.version` on the branch (e.g. to `28-proposed`) so the two `$id`s are never
confusable.

**Using it.** A scenario declares which schema judges it:

```jsonc
{ "schema": "proposed", "expect": { "standard": "valid", "extension": "n/a" } }
```

Default is `published`. `check-scenarios` picks the validator per scenario and checks
`coversDefs` against that schema's `$defs`, so a proposal can introduce new objects without
tripping the typo check. Declaring `proposed` with no such file on disk is an error rather
than a silent fallback.

**Boundaries that matter:**

- `spec/mnx-schema.json` stays a byte-for-byte copy of the pinned release. A proposal never
  edits it — otherwise "does this validate against MNX?" stops having an answer.
- The Worker's precompiled validators and the AI retry loop use the **published** schema only.
  Teaching the LLM to emit unadopted fields would poison the primary defence against schema
  drift.
- `npm run build` and the deploy must not need the proposed schema, same rule as the submodule.
- **On adoption:** move the pin, re-vendor `mnx-schema.json`, then delete
  `mnx-schema.proposed.json` and every `"schema": "proposed"` declaration. The pattern is
  scaffolding, not a permanent second spec.

### Local doctools setup with uv

The generator is a separate package — **`spectools`**, from
[w3c-cg/mnxdocgenerator](https://github.com/w3c-cg/mnxdocgenerator). It is not on PyPI
and `doctools/requirements.txt` omits it deliberately, so it must be installed from git.
No clone needed (the README's `pip install -e` is for people editing the generator):

```bash
cd vendor/mnx/doctools
uv run --python 3.12 \
  --with django==4.2.24 --with lxml \
  --with git+https://github.com/w3c-cg/mnxdocgenerator.git \
  python manage.py runserver          # site :8000, admin /admin/ (admin/admin)
```

First run needs `manage.py migrate` then `manage.py loaddb data.json`. Edit in the
admin, then `manage.py freezedb data.json`.

> If you prefer a persistent venv, name it **`venv`**, not `.venv` — upstream's
> `.gitignore` covers `venv/` but not `.venv/`, and a stray `.venv` shows up as
> untracked inside the submodule.

`loaddb` → `freezedb` round-trips `data.json` byte-identically (verified 2026-07-27), so
re-freezing before you commit is a cheap check: any hunk you didn't intend is a mistake.
