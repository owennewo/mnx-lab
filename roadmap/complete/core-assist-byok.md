# Bring your own key — the workbench's last backend dependency, removed

> **Status: COMPLETE 2026-08-22.** All four remainders closed — the loop moved behind
> the transport, the CSP shipped and is smoke-tested, the Worker is explicitly a demo,
> and studio's adoption is recorded as a deferred promotion with its trigger named.
> Details in *Closing out* at the foot of this doc.

Serves the **implementation loop**. Apparatus for the assist layer: the user's
own OpenRouter key, obtained by OAuth PKCE or by paste, held in the browser and
spent browser-direct — so live AI edits no longer need the Worker.

## The rule this completes

CLAUDE.md's workbench rule reads *"fully functional (minus live AI edits) from
static build output alone."* The parenthetical exists because the Worker holds
`OPENROUTER_API_KEY`; it is a secrets proxy and nothing else. With the key in
the browser the asterisk goes: every call the workbench makes to OpenRouter is
one the user's own browser makes with the user's own key, and the Worker's only
remaining role is spending a key that is not the user's — a demo, or evals.

The edit loop was already portable. It imported the prompt, a validator from
`worker/generated/` (schema DATA, importable from any layer) and
`src/assist/protocol.ts`; it used `fetch` and a bearer header and nothing of
Node or the DOM. Moving it to `src/assist/` with the transport as a parameter
was the next step, and it is now done — see *Closing out*.

## Two ways in, one state

**BYOK is the state** — the user's key, in the browser. PKCE and paste are the
two ways of reaching it:

- **PKCE** — `https://openrouter.ai/auth?callback_url=…&code_challenge=…&code_challenge_method=S256`;
  the user approves once; OpenRouter redirects back with `?code=`; the browser
  POSTs code + verifier to `/api/v1/auth/keys` and receives a **distinct
  per-app key** — revocable and spend-attributed on its own, the master key
  never seen by us. Designed for public clients: the verifier/challenge pair is
  what a client without a secret carries instead of one. Codes expire after
  ten minutes; failure restarts rather than retries.
- **Paste** — for the user who made a key with their own spend limit. Ten
  lines, validated by the `/api/v1/key` lookup before it is stored.

Both are backend-free. CORS is permitted from any origin, localhost included,
so `npm run dev` exercises the full loop; the only requirement is a secure
context for `crypto.subtle`, which localhost is and a LAN-IP dev URL is not.

## Decisions

- **The key lives in the shell, never in `elements/`.** The embed face runs on
  foreign host pages; a credential store there would be exactly the wrong
  thing. `src/assist/openrouter.ts` passes keys in and hands them back and
  touches no storage; `src/workbench/assistCredentials.ts` owns persistence
  (`mnx-lab.openrouter-key`, localStorage) and the PKCE round trip (verifier
  and return route in sessionStorage — they must survive the redirect and die
  with the tab).
- **The callback carries no hash.** OpenRouter appends `?code=` to it, and a
  search param after a fragment is not a search param. The callback is
  `location.origin + location.pathname`, derived at runtime (the dev server
  took 5174 the day 5173 was busy); the route is stashed and restored, and the
  code is scrubbed from the address bar before the exchange so a stale code
  cannot become a restart hazard.
- **XSS is now a credential vector — and the codebase is in good shape for
  it.** The only `innerHTML` uses in `src/` are clears; everything renders
  through Lit templates, which escape. A CSP header on the deploy is the
  precondition that remains before this is more than a lab feature.
- **No tools first.** The connectivity probe is a plain streamed chat against
  `/chat/completions`, SSE parsed into deltas. The edit loop rides the same
  transport once it moves.

## What it does to the model selector

[core-assist-model-selector.md](core-assist-model-selector.md)'s open
question — must the Worker honour any model id, given it spends the
deployment's key? — dissolves: it is the user's money. The roster allowlist
is only for the server-key demo mode. And the free tier's 50 req/day is per
OpenRouter account, so the picker's free lane stops sharing one pool across
every visitor.

## Built so far (2026-08-20)

- **`src/assist/openrouter.ts`** — PKCE challenge (RFC 7636 S256, pinned to
  the appendix-B vector), authorize URL, code→key exchange, key fingerprint
  (hex SHA-256), `/api/v1/key` lookup, and `streamChat` over a pure SSE delta
  parser. `harness/conformance/openrouter-client.test.ts` covers the pure
  halves with injected `fetch`.
- **`src/workbench/assistCredentials.ts`** — store/forget/begin/complete; the
  app shell exchanges the code at boot and parks the verdict for the assist
  tab.
- **The assist tab** — connect block (PKCE CTA + paste fallback) when no key;
  a plain chat with the picked model when connected; *forget key* in the
  context bar. Verified hands-on over CDP against the real OpenRouter API:
  paste → "key rejected", chat → OpenRouter's own `401 — User not found.`, the
  auth request carrying `callback_url=http://localhost:5174/` + S256
  challenge, and a fake-code landing cleaning the URL, restoring the route and
  surfacing the exchange failure on the assist tab. The approval click itself
  is the one step a headless browser cannot take.

- **Markdown and history (same day)** — assistant replies render through a
  small markdown subset parsed to an AST (`src/assist/markdown.ts`, pinned by
  `markdown.test.ts`) and emitted as Lit templates (`workbench/markdownLit.ts`):
  no HTML sink exists, so `<img onerror>` in a reply is text and only http(s)
  hrefs become links (`rel="noopener noreferrer"`). **GFM pipe tables** joined
  the subset the same day — alignments, inline cells, escaped pipes, ragged
  rows padded to the header's width — with two rules the panel imposed: a
  table is only a table once its DELIMITER row arrives (mid-stream the header
  is still a paragraph, the fenced-code flicker again), and it scrolls inside
  its own wrapper, because the five-band frame allows exactly one scrolling
  region. A markdown LIBRARY was rejected for this: an HTML-emitting
  dependency is exactly the sink the hand-rolled subset exists to avoid. The conversation persists
  in sessionStorage — survives switching scenarios, dies with the tab — and
  *clear* in the context bar wipes it. Verified over CDP.

## Closing out (2026-08-22)

### The loop moved, behind an interface it declares itself

`worker/editLoop.ts` → **`src/assist/editLoop.ts`**, and `worker/prompts/` →
`src/assist/prompts/` with it (the boundary required that: `assist/` may not import
`worker/`, and `worker/generated/` is the standing exception because it is schema DATA).
The loop no longer knows OpenRouter exists. It declares

```ts
type ChatTransport = (req: ChatCompletionRequest) => AsyncGenerator<ChatDelta>
```

and is handed one — `openRouterEditTransport(...)` from `openrouter.ts`, built over the
same SSE parser the assist tab's plain chat uses. **One parser, two faces**:
`sseChatDeltas` yields content + tool-call + usage deltas and `sseTextDeltas` filters it
down to text, rather than the loop forking a second copy of the same parsing.

Two things moved *with* the transport because they were never about self-correcting:

- **The `required`→`auto` `tool_choice` fallback.** It is an OpenRouter provider quirk
  (Qwen answers a non-default `tool_choice` with a 404), so it belongs with the provider.
  The working value is memoized in the transport's closure, so one edit pays the
  discovery cost once — the same behaviour the loop had, in the layer that owns the fact.
- **Attribution headers.** `HTTP-Referer`/`X-Title` are how the user sees this app in
  *their own* OpenRouter activity log now that it is their key.

Validators became **lazy** (`loadEditValidators`, memoized). Static imports would have
pulled ~196 kB of Ajv into the browser's initial bundle for a feature most sessions never
use; `model/pinnedErrors.ts` already loads the same chunk the same way, so it is shared.

**The payoff is testability, and it is immediate.**
`harness/conformance/edit-loop.test.ts` (10 assertions) drives the entire loop with a
scripted generator and no network — the happy path, self-correction with the synthetic
`role: 'tool'` error re-entering the conversation, the extension schema as a genuinely
separate second verdict, exhaustion after `maxAttempts`, an empty tool call as "no edits
made", and the promise that it never throws. Before the move, only a live key could
exercise any of that. Four more in `openrouter-client.test.ts` pin the transport itself,
including that a non-`tool_choice` failure is **not** retried under a different value —
the cause is reported as it happened.

### One call site, two paths

`streamEditNotation` in `src/assist/stream.ts` takes an optional `apiKey`:

| | path | done frame |
|---|---|---|
| key held | the loop runs **in this browser**, straight to OpenRouter | unstamped |
| no key | POST `/api/edit-notation` | `demoMode` |
| no key, none deployed | the offline mock | `mockMode` |

Same frames, same iterator, same union — a caller cannot tell the paths apart except by
the stamp, which is the point: **the UI that will call this
([core-editor-ai-prompt.md](../proposed/low-priority/core-editor-ai-prompt.md)) gets one surface, not a
branch.** The loop reports progress through a callback (for the evals harness); the
browser-direct adapter queues those frames and drains them between awaits so progress
still arrives *before* the done frame rather than batched behind it — asserted.

There is deliberately **no UI change here**. The edit surface is
core-editor-ai-prompt's item and always was; this one builds the thing it consumes. What
that means honestly: the browser-direct path is proven by tests, not by a click.

### The CSP, and a smoke test so it cannot rot

`public/_headers` (Vite copies it into `dist/client/`, which is what wrangler uploads):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://openrouter.ai;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`script-src 'self'` is the whole point — with a key in localStorage, an injected script
is a credential theft rather than a defacement — and the codebase already earned it: no
`eval` (the precompiled validators exist for that reason), no CDN (fonts are bundled,
SMuFL is served from `/smufl`), no HTML sink (assistant markdown is parsed to an AST and
emitted as Lit templates).

**`'unsafe-inline'` in `style-src` is a bounded exception, not laziness.** CSS cannot
read localStorage, so it is not on the path this policy closes; removing it would mean
nonce-stamping the shell for no gain against this threat. That is not an assertion — the
mutation check ran: tighten `style-src` to `'self'` and the smoke test reports exactly
two violations, `style-src-elem` (index.html's six-line inline block) and
`style-src-attr` (Lit templates' `style=` attributes). Those two, and nothing else.

**`npm run smoke:csp`** (`harness/verify/csp-smoke.mjs`) reads the policy *out of
`public/_headers`* so the test and the deploy cannot drift, serves the real
`dist/client` under it, boots the workbench in headless Chrome and requires three things:
zero `securitypolicyviolation` events during boot; the app actually rendered (a policy
that blocks everything must not pass by silence — it asserts a score reached the DOM);
and the policy is *enforced*, proved by a fetch to an unnamed origin being refused. Not
in `npm test` — it needs Chrome and a build, like `smoke:embed`.

### The Worker is a demo, and says so

Not renamed, not deleted — **stamped**. Every done frame `/api/edit-notation` produces
carries `demoMode: true` (server key) or `mockMode: true` (no key at all), and the header
comment says plainly that a user with their own key never reaches this route. The stamp
is applied by the *route*, not the loop: the loop cannot know whose key its transport
carries, and should not learn.

That is a better demotion than a rename would have been, because it is legible at
runtime. A UI can now say "this edit was on the lab's key" without inspecting config, and
an unstamped frame is a positive assertion that the user's own key paid.

### Studio: a promotion with a named trigger, deliberately not taken

Recorded in [apps/studio/README.md](../../apps/studio/README.md) rather than built. The
split that matters already exists: `src/assist/openrouter.ts` is pure over
`fetch`/`crypto` and touches no storage, so **studio can consume it today**. Only
`src/workbench/assistCredentials.ts` — localStorage keys, the PKCE redirect round trip —
is shell-specific, and studio may not import it (the workbench is a leaf;
dependency-cruiser makes trying a red build).

Promoting it now would mean guessing at studio's routing and session model, which are the
two things the module actually depends on, for a consumer that does not exist. The repo's
own rule is that a shared surface graduates when a real second consumer needs it, so the
README names the move and its trigger, and the item closes without pretending otherwise.

### Gates

`npm test` 915 (14 new), `check:scenarios` 107 unchanged, `npm run build` with boundaries
clean, `build:lib`, `build:embed`, `smoke:lib`, `smoke:csp`.
