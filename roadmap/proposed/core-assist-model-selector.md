# Model assessment and selection — the roster as a query, not a list

Serves the **implementation loop**. Apparatus for the assist layer: choosing which
LLMs the edit loop is offered, made systematic.

## The problem

[worker/models.json](../../worker/models.json) is a hand-curated static roster —
nine ids somebody once thought well of, served verbatim by `/api/models`. The
catalog it curates *from* (OpenRouter's `/api/v1/models`) is ~420 models and
churns constantly: models appear, deprecate, reprice; the free pool (the `:free`
suffix, currently 17 strong) rotates on someone else's promotional schedule. So
every judgement embedded in the roster decays silently, and answering a question
as simple as the one that motivated this item (2026-08-20) — *"the best free
model that supports tool calling and isn't crazy slow"* — means a human reading
a webpage. That question is a **query**, and nothing in the repo can run it.

The retired [core-open-router.md](../superseded/core-open-router.md) did the
same thing manually one layer up: a table partitioning workload across two
hand-picked model ids, with a rationale column. The rationale column is the
tell — the *requirements* were articulable; only the lookup was manual.

## The module

A pure function, catalog in, verdict out:

```
selectModels(requirements, catalog): ScoredModel[]
```

The **requirements definition** is data (versionable, committable), in two
halves that the algorithm treats differently:

- **Hard constraints** — pass/fail filters. Required capabilities
  (`tools` is the ever-present one here: [worker/editLoop.ts](../../worker/editLoop.ts)
  forces the `update_document` tool call, so a model without tool support is
  useless to the edit loop regardless of any score), minimum context length,
  a price ceiling per Mtok (ceiling 0 = free-only), streaming, data-policy
  (no-training), modality.
- **Soft preferences** — the dimensions survivors are ranked on, each with a
  weight: price below the ceiling, latency/throughput, context headroom,
  quality.

Filter first, then rank. A model that fails a hard constraint never appears,
however spectacular its other dimensions — that is what makes a constraint hard.

## The ordering problem — the half that is actually interesting

The rank is multi-dimensional and the dimensions are incommensurable ($/Mtok vs
ms vs tokens of context), so "best" needs a construction, not a `sort()`. The
design this item proposes:

- **Normalize by the requirement itself.** Each soft dimension scores as
  *headroom over the requirement*: `actual/required` for more-is-better
  dimensions (context), `ceiling/actual` for less-is-better ones (price,
  latency). The requirements definition is the unit system — "exceeds the
  requirement by 4×" is the one phrasing in which context and cost are
  comparable, which is exactly the user-facing intuition this item exists to
  encode.
- **Log the ratios.** Headroom has diminishing returns: 8× the required context
  is not four times better than 2×. `log(ratio)` makes exactly-meeting a
  requirement score 0, makes surplus and shortfall symmetric, and stops one
  spectacular dimension from drowning three adequate ones.
- **Price is a workload blend, computed here — the catalog has no single
  number.** OpenRouter's `pricing` object is strictly per-meter (`prompt`,
  `completion`, optional `input_cache_read`/`input_cache_write` — most models
  do not even declare cache pricing), and no "effective price" field exists in
  the API. Leaderboards blend at a fixed editorial ratio (typically 3:1
  input:output), but a blend is only meaningful relative to a workload — so the
  blend lives in the **requirements definition, not the catalog**: the profile
  declares an expected token mix (input : output : cached), and effective
  $/Mtok is the dot product of that mix with the model's per-meter prices. A
  model without cache pricing prices cached tokens at its full `prompt` rate,
  which is also what it would actually charge. This matters concretely because
  the edit loop's mix is unusual — a large prompt (document + schema + system
  prompt) *and* a large completion (the model rewrites the whole document
  through the tool call), with retries re-sending the prompt — so a generic
  3:1 blend would genuinely misrank models here, and cache-read pricing counts
  for more than usual. The profile follows the same declared-then-measured
  staging as quality: it starts as an estimate, and OpenRouter's per-request
  usage accounting (`/api/v1/generation` returns realized `total_cost`) lets
  the measured mix replace it once edit-loop evals exist.
- **Weighted sum over the logged ratios**, weights from the requirements
  definition with declared defaults. With positive weights and monotone
  per-dimension utilities this scalarization respects **Pareto dominance** — a
  model worse-or-equal on every dimension can never outrank its dominator.
  That is the invariant to pin in the test, rather than any particular score:
  scores may be retuned, dominance violations are bugs by definition.
- **Missing data is neither zero nor perfect.** The catalog has no latency
  numbers at all in its main endpoint; per-provider stats exist but are noisy
  and optional. An unknown dimension scores as *requirement exactly met*
  (utility 0) and the result row says so — an honest "no evidence" that
  neither rewards nor punishes, and never silently.
- **Quality is in no API.** This is the *assessment* half of the name. Two
  sources, staged: a curated prior table versioned alongside the roster
  (declared data, reviewable like everything else here), and eventually our own
  task-specific evidence — `editLoop.ts` is already factored for future evals,
  and first-attempt schema-valid rate / retries-consumed per model *is* a
  quality score for precisely this workload. When that exists, the module stops
  ranking on reputation and starts ranking on our corpus.

## Data sources, and where fetching lives

`/api/v1/models` supplies id, pricing, `context_length` and
`supported_parameters` — enough for every hard filter and the price dimension.
Per-endpoint stats are an optional adapter later; edit-loop outcomes later
still. **The scorer never fetches**: adapters at the edge produce a catalog
value, the module is pure over it, and the tests run against a committed
catalog snapshot — same pattern as the rest of the harness, and what keeps the
scoring core importable from anywhere.

## Placement and consumers

The layer order says the Worker imports `model` + `assist` only, so the scoring
core lives in `src/assist/` (say `modelSelect.ts`) — pure, DOM-free, fetchless —
and is thereby reachable from the Worker, the harness, and dev scripts alike.

The **first consumer is dev-time, not runtime**: a script that runs stored
requirement definitions against a fresh catalog and regenerates
`worker/models.json` — the roster stays static, committed and reviewable (git
is the database here, as everywhere in this repo), but becomes the *output of
stored queries* instead of a hand-list. The natural acceptance test follows:
requirement definitions that reproduce the current roster's judgement, so the
curation is finally articulated rather than embedded.

The **second consumer** makes the ordering itself load-bearing: OpenRouter's
chat API accepts an ordered `models: []` fallback array and falls through on
rate-limit or outage. The selector's ranked output is exactly that array, and
the free tier's rate limits (~20 req/min, 50–1000 req/day) make fallback a real
need rather than a flourish.

## Not in scope

- **A benchmarking harness.** Quality priors stay declared data until the
  edit-loop evals exist; this item does not build them.
- **Automatic runtime model switching.** Selection output is reviewed and
  committed like every other verdict in the repo — the module proposes, a
  human (or at least a diff) disposes.
- **Other aggregators.** OpenRouter is already the provider abstraction;
  teaching the module a second catalog shape buys nothing today.
