# Edit-loop evals — ranking models on our corpus instead of on reputation

> **Status: proposed (2026-08-22).** Split out of
> [core-assist-model-selector.md](../../complete/core-assist-model-selector.md) as the one
> thing that item deliberately did not build (*"Not in scope: a benchmarking
> harness"*). That item closed with its selector, roster generator, picker and
> fallback chain shipped and one seam left open — this doc owns the seam.

Serves the **implementation loop**. Apparatus for the assist layer: measured
evidence about which models can actually drive our edit loop.

## The seam

`src/assist/modelCatalog.ts` carries `MODEL_PRIORS`: seventeen families with a
hand-set `intelligenceIndex` and `tokensPerSecond`, read off public
leaderboards on 2026-08-20 and deliberately coarse. Everything downstream is
already shaped for better data — `selectModels()` reads two optional numbers
per model, `requireKnown` states which dimensions must have evidence, and the
roster generator refuses a model that has none. Nothing needs to change in the
scoring core. What is missing is a **source**.

The prior table has three specific weaknesses, and only the third is
interesting:

1. **It decays.** Same problem as the hand-list of ids the roster used to be,
   one level down.
2. **It inherits sideways.** Priors are matched with the `:variant` suffix
   stripped, so a `:free` endpoint claims its family's throughput — same
   weights, other hardware. Speed is the shakier half of that inheritance and
   the module says so.
3. **It measures the wrong thing.** An intelligence index is a claim about a
   model in general. The edit loop asks something far narrower: *can you emit a
   valid MNX document through a forced tool call, first try?* A model can be
   excellent at the former and useless at the latter, and no leaderboard will
   ever tell us which.

## The metric that already exists in the loop

`worker/editLoop.ts` was factored for evals before there were any. It forces
the `update_document` tool call, validates the result against the published
schema **and** every `_x.mnxLab` dict against the extension schema, and feeds
failures back as a synthetic `role: 'tool'` message, up to three attempts.
That control flow already emits the numbers:

- **first-attempt validity** — the fraction of runs whose first tool call
  passed both verdicts. This is the quality score for this workload.
- **retries consumed** — the distribution, not just the mean; a model that
  usually needs one correction is a different animal from one that
  occasionally needs three.
- **terminal failure rate** — ran out of attempts.
- **realized cost and latency** — OpenRouter's `/api/v1/generation` returns
  the actual `total_cost` per request, which is also the measured answer to
  the token-mix estimate `DEFAULT_TOKEN_MIX` currently guesses
  (`{ input: 2, output: 1, cached: 1 }`, declared pending exactly this).

## What has to be decided

- **The task set.** The corpus is right there, but a scenario is a *document*,
  not an *edit*. An eval case is (document, instruction, verdict), and the
  verdict has to be machine-checkable without being so narrow that only one
  phrasing of the right answer passes. The edit-op traces
  (`harness/conformance/edit-traces.test.ts`) are the nearest existing shape
  and the first place to look.
- **Who pays.** Running N models × M cases is real money against somebody's
  key. BYOK means it can be the developer's own; it also means this is
  explicitly a dev-time script, never a deployed endpoint, and never something
  a build runs.
- **Where the numbers land.** They must arrive as committed, reviewable data —
  the repo's rule everywhere else — which means a results file joined the way
  `MODEL_PRIORS` is joined today, carrying its own provenance (when, which
  cases, how many runs) and *not* silently replacing a declared prior with a
  measured one under the same name. A model scored by measurement and one
  scored by reputation should be distinguishable in the picker, because they
  are not the same kind of claim.
- **Non-determinism.** A single run of a single case is nearly worthless.
  Sample size, temperature and how a flaky pass is reported are part of the
  design, not an afterthought.

## Not in scope

- **A general LLM benchmark.** The only question is whether a model can drive
  *this* loop.
- **Automatic promotion.** Measurement feeds the priors; a person still runs
  the roster regeneration and reviews its diff. Silent model switching stayed
  out of scope in the selector item and stays out here.
