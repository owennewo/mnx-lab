<!-- Split out of CLAUDE.md; CLAUDE.md links here and keeps the rules that
     must hold in every session. Paths in prose are repo-root-relative. -->

# AI editing flow — one loop, two paths

`src/assist/stream.ts` is the **designated single entry point** and it picks the path:
hand it the user's key and the loop runs browser-direct against OpenRouter; hand it none
and it POSTs to `/api/edit-notation`, the Worker's demo. Today only
`harness/conformance/edit-loop.test.ts` calls it — the workbench UI that will
(the AI prompt surface, roadmap/proposed/low-priority/core-editor-ai-prompt.md) is not
built yet; the assist drawer's text chat goes through `openrouter.ts`'s `streamChat`
instead. Both of stream.ts's paths yield the same
`src/assist/protocol.ts` frames from the same iterator — on the wire as NDJSON for the
demo, in-process for BYOK — so a caller tells them apart only by the `demoMode`/`mockMode`
stamp on the done frame. **An unstamped done frame means the user's own key paid for it.**

`src/assist/editLoop.ts` runs the loop: forced `update_document` tool call, streamed
accumulation, then **two verdicts** — the official schema and every `_x.mnxLab` dict
against the extension schema. On failure the failed tool call + a synthetic
`role: 'tool'` error re-enter the conversation, up to 3 attempts.
`formatValidationErrors` deliberately filters `anyOf`/`oneOf`/`allOf` noise down to the
`event` branch — don't "fix" it, that makes errors unusable.

The loop knows nothing about OpenRouter. It declares a **`ChatTransport`** and is handed
one, which is why `harness/conformance/edit-loop.test.ts` can drive the whole
self-correction with a scripted generator and no network. The
`required`→`auto` `tool_choice` fallback lives in `openRouterEditTransport`, not the
loop: it is a provider quirk, not part of self-correcting. **Never restore a hardcoded
`fetch` to the loop** — that is what made it Worker-only and untestable.

Validators load **lazily** (`loadEditValidators`), so the browser bundle does not carry
196 kB of Ajv until an edit actually happens. **Workers can't run `ajv.compile()`**, so
they are precompiled by `spec/tools/compile-validator.mjs` into `worker/generated/`
(committed; rebuilt by `npm run build`). **The loop uses the published schema only** —
never teach the LLM proposed-schema fields. When touching
`src/assist/prompts/editNotation.ts` (the LLM-facing system prompt, §-numbered so
sections are addressable) or the tool schema, mirror structural rules (plural
`notes` array, etc.) — they are the primary defense against schema drift. With no
`OPENROUTER_API_KEY` (from `.dev.vars` locally, a Worker secret in prod) the demo route
falls back to the shared mock (`src/assist/mock.ts`) so the UI stays demoable.

**The key is a credential, so the deploy carries a CSP** (`public/_headers`, copied into
`dist/client/` by Vite). `script-src 'self'` is the directive that matters and the
codebase earns it — no `eval`, no CDN, no HTML sink. `npm run smoke:csp` boots the built
workbench under the deployed policy in headless Chrome and fails on any violation; the
`'unsafe-inline'` in `style-src` is a bounded, documented exception (CSS cannot read
localStorage). Add a CDN or an inline script and that smoke test is what tells you.

**Which model** is a query, not a list. `src/assist/modelSelect.ts` is the pure scorer
(hard filters, then a weighted sum over per-dimension *headroom over the requirement*);
`src/assist/roster.ts` runs the stored queries in `worker/models.query.json` to
**generate** `worker/models.json`, so hand-editing the roster is a red test — regenerate
with `npm run update:roster`. Only `npm run refresh:catalog` touches the network. The
roster governs the **server-key demo mode only**: with BYOK the user's key buys whatever
`<mnx-model-picker>` was pointed at, and the picker's runners-up ride along as
OpenRouter's ordered `models: []` fallback chain. Quality is still a declared prior table
in `modelCatalog.ts` — roadmap/proposed/low-priority/core-assist-evals.md owns replacing it with
measured evidence.
