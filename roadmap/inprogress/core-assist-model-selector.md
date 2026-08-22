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
  (`tools` is the ever-present one here: [src/assist/editLoop.ts](../../src/assist/editLoop.ts)
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

The **third consumer is the picker surface** below — the same query, run by a
person at runtime, in both shells.

## The picker surface — the query as UI

The selection mechanism is wanted **in both the workbench and the future
studio** (2026-08-20 design conversation), which decides its shape before any
mockup does:

- **Where it sits.** Wherever the assistant lives (in the workbench, the assist
  tab of the side panel), the top of that surface shows the **currently
  selected model** and the affordance to switch it. Switching opens a **query
  dialog**: criteria on top — an effective-price slider (the workload blend
  above, as one number a slider can sweep), minimum tokens/sec, minimum
  intelligence index — then *run*, and the **top-n ranked models** come back
  with the best one pre-selected. The user may take the recommendation or pick
  another row, and closing the dialog commits the choice. The criteria widgets
  are the requirements definition wearing controls: slider = price ceiling +
  weight, minimums = hard floors, so the dialog needs no vocabulary the module
  doesn't already have.
- **Persistence is presentation.** The chosen model and the query parameters
  live in `localStorage` — per-browser preference, the same tier as the
  remembered theme, never document data and never a committed verdict. The
  committed roster stays what it was: the reviewed default a fresh browser
  starts from.
- **The two-shell claim triggers the promotion rule.** Anything two shells want
  is first promoted into `elements/` or below — a deliberate, reviewed move,
  and the picker lands on the same open boundary question
  [core-editor-ai-prompt.md](../proposed/core-editor-ai-prompt.md) already carries for the
  palette: `elements/` may not import `assist/` today. The scoring core being
  pure and DOM-free is what keeps every resolution of that question cheap; the
  dialog is the only Lit in the story. Incubating the dialog in `workbench/`
  against a neutral contract (the score-HUD precedent) and promoting on
  studio's actual arrival is the expected path.
- **Where the runtime catalog comes from** is the one real design tension the
  picker adds. The workbench has no backend by rule, so the dialog either
  queries OpenRouter's public catalog endpoint live from the browser (fresh,
  but the result set moves under you and needs the network) or queries the
  committed snapshot (reviewable, offline, but staleness is the point of the
  churn problem). The likely answer is both — snapshot as the floor, live
  refresh as an explicit action in the dialog — but the item should decide,
  and the intelligence-index priors are committed data either way.
- **The Worker must honour the choice.** A picked model id reaches
  `/api/edit-notation` as a parameter; whether the Worker accepts any syntactic
  model id or insists on the roster is a real decision this item owns (the
  Worker is a secrets proxy spending the deployment's OpenRouter key, so
  "anything" has a cost story, not just a validation story).
  **Resolved 2026-08-20 by [core-assist-byok.md](../complete/core-assist-byok.md)**: with
  the user's own key spent browser-direct, any model id is fine — it is their
  money; the roster allowlist applies only to the server-key demo mode.

## Not in scope

- **A benchmarking harness.** Quality priors stay declared data until the
  edit-loop evals exist; this item does not build them.
- **Automatic (silent) model switching.** A person running the query and
  committing a choice — the picker above — is in scope; the system swapping
  models mid-session on its own verdict is not. The committed roster remains
  the reviewed default; localStorage holds only a per-browser preference.
- **Other aggregators.** OpenRouter is already the provider abstraction;
  teaching the module a second catalog shape buys nothing today.

## Built so far (2026-08-20)

The picker surface and the scoring core landed together, incubating in the
shell as planned:

- **`src/assist/modelSelect.ts`** — the pure core as specified: requirement-
  normalized log2 headroom, weighted sum, unknown-passes-flagged, deterministic
  tie-break. The contract is pinned by
  `harness/conformance/model-select.test.ts`, including the dominance invariant
  under multiple weightings and the motivating free-model query against the
  committed snapshot.
- **`src/assist/modelCatalog.ts` + `modelCatalog.snapshot.json`** — 413
  assessable models (router pseudo-models price as −1, "depends on the routed
  model", and are excluded at the adapter edge, both live and in the snapshot
  generator); the curated prior table covers 17 model families, matched with
  `:variant` suffixes stripped so a `:free` endpoint inherits its family's
  prior.
- **The workbench assist tab** — sixth panel tab on the scenario page: context
  bar carries the current model and the switch-model CTA, the body is an honest
  placeholder (the chat surface belongs to
  [core-editor-ai-prompt.md](../proposed/core-editor-ai-prompt.md)), the footer
  input is disabled and says so. `PANEL_MIN` moved 360 → 410 because the width
  floor and the tab set are one decision. `<mnx-model-picker>` follows the
  command palette's modal idiom; its keydown handler stops propagation so the
  page's window-scoped keymap never sees a dialog keystroke.
- **Persistence** — `mnx-lab.assist-model` and `mnx-lab.assist-query` in
  localStorage, presentation-tier as decided. Verified hands-on in headless
  Chrome over CDP: open tab → open dialog → slide to free-only → pick →
  header updates and both keys persist.

Remaining: the dev-time roster regeneration script, the `models: []` fallback
array (blocked on the chat/edit wiring), quality from edit-loop evals
replacing the prior table, and the `elements/` promotion when studio arrives.
