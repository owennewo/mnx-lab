# Bring your own key — the workbench's last backend dependency, removed

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

The edit loop was already portable. `worker/editLoop.ts` imports the prompt, a
validator from `worker/generated/` (schema DATA, importable from any layer) and
`src/assist/protocol.ts`; it uses `fetch` and a bearer header and nothing of
Node or the DOM. Moving it to `src/assist/` with the transport as a parameter
is the next step; this item builds the transport.

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

Remaining: move `editLoop.ts` into `src/assist/` behind this transport; the
CSP header; the Worker demoted to an explicit demo mode; studio adopts the
same credentials module.
