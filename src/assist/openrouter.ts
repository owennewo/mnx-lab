// The browser-direct OpenRouter client — BYOK, no backend
// (roadmap/complete/core-assist-byok.md). Two halves, both pure over
// fetch/crypto and fetchless at module level:
//
//   PKCE  — the challenge a public client can carry without a secret, and the
//           code→key exchange OpenRouter designed for exactly this. The key it
//           returns is a DISTINCT per-app key the user can revoke and attribute
//           independently; their master key never reaches us.
//   chat  — streaming completions against /chat/completions, SSE parsed into
//           deltas. Two faces over ONE parser: `streamChat` yields text (the
//           assist tab's plain chat) and `openRouterEditTransport` yields
//           text + tool-call + usage deltas, which is the `ChatTransport` the
//           self-correcting edit loop runs on. The loop no longer knows this
//           file exists — it declares the interface, this implements it.
//
// Nothing here touches localStorage: keys are passed in and handed back, and
// persistence is the shell's decision (workbench/assistCredentials.ts), so the
// embed face can never grow a credential store by accident.

import type { ChatCompletionRequest, ChatTransport, ToolChoice } from './editLoop.ts';

const AUTH_URL = 'https://openrouter.ai/auth';
const KEYS_URL = 'https://openrouter.ai/api/v1/auth/keys';
const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const KEY_INFO_URL = 'https://openrouter.ai/api/v1/key';

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}

/** S256 challenge for a verifier. `crypto.subtle` needs a secure context —
 *  https, or localhost, which browsers treat as secure; a LAN-IP dev URL
 *  fails HERE, not at OpenRouter. */
export async function pkceChallenge(verifier: string): Promise<string> {
  return base64url(await sha256(verifier));
}

export function newPkceVerifier(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

/** The redirect target. `callbackUrl` must carry NO hash fragment: OpenRouter
 *  appends `?code=` to it, and a search param after a `#` is not a search
 *  param — the shell stashes its route separately and restores it. */
export function pkceAuthorizeUrl(callbackUrl: string, challenge: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set('callback_url', callbackUrl);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

/** Code → key. Codes expire ten minutes after issue, so the caller should
 *  exchange on landing and treat failure as "start over", not retry. */
export async function exchangePkceCode(code: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(KEYS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' })
  });
  if (!res.ok) throw new Error(`key exchange failed: ${res.status}`);
  const body = (await res.json()) as { key?: string };
  if (!body.key) throw new Error('key exchange: no key in response');
  return body.key;
}

/** Hex SHA-256 of a key — how OpenRouter identifies a key without showing
 *  it, and a safe thing to display or log. */
export async function keyFingerprint(key: string): Promise<string> {
  return [...new Uint8Array(await sha256(key))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface KeyInfo {
  label?: string;
  usage?: number;
  limit?: number | null;
  isFreeTier?: boolean;
}

/** What OpenRouter knows about the key — also the cheapest "is this key
 *  live?" probe, which is how a pasted key is validated. */
export async function fetchKeyInfo(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<KeyInfo> {
  const res = await fetchImpl(KEY_INFO_URL, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (res.status === 401 || res.status === 403) throw new Error('key rejected');
  if (!res.ok) throw new Error(`key lookup failed: ${res.status}`);
  const body = (await res.json()) as { data?: { label?: string; usage?: number; limit?: number | null; is_free_tier?: boolean } };
  const d = body.data ?? {};
  return { label: d.label, usage: d.usage, limit: d.limit, isFreeTier: d.is_free_tier };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  /** Attribution headers OpenRouter shows in the activity log — the page's
   *  origin and a name, so local runs are distinguishable from production. */
  referer?: string;
  title?: string;
  fetchImpl?: typeof fetch;
}

/** One chunk of a streamed completion, in the shape a caller might need:
 *  free text, a tool call accumulating its arguments, or the usage frame
 *  OpenRouter sends near the end. Each field is present only when the frame
 *  carried it. */
export interface ChatDelta {
  content?: string;
  toolCallId?: string;
  toolArguments?: string;
  completionTokens?: number;
}

/** Deltas from one SSE body. Pure over the stream so it tests without a
 *  network: frames are `data: <json>` lines, blank-line separated, ending in
 *  `data: [DONE]`; OpenRouter also interleaves `: ` comment lines as
 *  keepalives, which are skipped.
 *
 *  A usage frame is yielded ALONE — OpenRouter sends it as its own frame and
 *  the edit loop reports it as progress rather than content. */
export async function* sseChatDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatDelta> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        let frame: {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: { id?: string; function?: { arguments?: string } }[];
            };
          }[];
          usage?: { completion_tokens?: number };
          error?: { message?: string };
        };
        try {
          frame = JSON.parse(data);
        } catch {
          continue;
        }
        if (frame.error) throw new Error(frame.error.message ?? 'stream error');
        if (frame.usage?.completion_tokens) {
          yield { completionTokens: frame.usage.completion_tokens };
          continue;
        }
        const delta = frame.choices?.[0]?.delta;
        const toolCall = delta?.tool_calls?.[0];
        const out: ChatDelta = {};
        if (delta?.content) out.content = delta.content;
        if (toolCall?.id) out.toolCallId = toolCall.id;
        if (toolCall?.function?.arguments) out.toolArguments = toolCall.function.arguments;
        if (out.content !== undefined || out.toolCallId !== undefined || out.toolArguments !== undefined) {
          yield out;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** The text-only face, for callers with no tools in play. */
export async function* sseTextDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  for await (const delta of sseChatDeltas(body)) {
    if (delta.content) yield delta.content;
  }
}

/** One streamed completion, browser-direct. Yields text deltas; throws on an
 *  HTTP error with OpenRouter's message when it gives one. */
export async function* streamChat(opts: ChatOptions): AsyncGenerator<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
    'Content-Type': 'application/json'
  };
  if (opts.referer) headers['HTTP-Referer'] = opts.referer;
  if (opts.title) headers['X-Title'] = opts.title;
  const res = await fetchImpl(CHAT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: opts.model, messages: opts.messages, stream: true }),
    signal: opts.signal
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = `${res.status} — ${body.error.message}`;
    } catch {
      /* no JSON body */
    }
    throw new Error(`chat failed: ${detail}`);
  }
  if (!res.body) throw new Error('chat failed: empty body');
  yield* sseTextDeltas(res.body);
}

// ---------------------------------------------------------------------------
// The edit loop's transport
// ---------------------------------------------------------------------------

export interface EditTransportOptions {
  apiKey: string;
  /** Attribution headers OpenRouter shows in the activity log. */
  referer?: string;
  title?: string;
  fetchImpl?: typeof fetch;
}

/**
 * A `ChatTransport` (declared by `editLoop.ts` — the consumer owns the
 * interface) that speaks to OpenRouter with the given key. The same function
 * serves the Worker's demo key and the user's own BYOK key; only who holds
 * the key differs, which is the whole point of the move.
 *
 * The `tool_choice` fallback lives HERE, not in the loop, because it is an
 * OpenRouter provider quirk rather than anything about self-correction: some
 * providers (Qwen, at least) answer any non-default `tool_choice` with a 404.
 * Start optimistic at `required`; the working value is memoized in this
 * closure, so one transport instance pays the discovery cost once and every
 * retry in that edit reuses it.
 */
export function openRouterEditTransport(opts: EditTransportOptions): ChatTransport {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let workingToolChoice: ToolChoice = 'required';

  return async function* transport(req: ChatCompletionRequest): AsyncGenerator<ChatDelta> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json'
    };
    if (opts.referer) headers['HTTP-Referer'] = opts.referer;
    if (opts.title) headers['X-Title'] = opts.title;

    const body = (tc: ToolChoice) =>
      JSON.stringify({
        model: req.model,
        messages: req.messages,
        tools: req.tools,
        tool_choice: tc,
        stream: true
      });

    const toTry: ToolChoice[] = workingToolChoice === 'required' ? ['required', 'auto'] : [workingToolChoice];
    let response: Response | null = null;
    let lastErrText: string | null = null;
    let lastStatus: number | null = null;

    for (const tc of toTry) {
      response = await fetchImpl(CHAT_URL, {
        method: 'POST',
        headers,
        body: body(tc),
        signal: req.signal
      });
      if (response.ok) {
        workingToolChoice = tc;
        break;
      }
      lastErrText = await response.text();
      lastStatus = response.status;
      // Only a tool_choice rejection falls through. Anything else (auth,
      // model-not-found, rate limit) bubbles up immediately — retrying it
      // under a different tool_choice would just misreport the cause.
      if (response.status === 404 && lastErrText.includes('tool_choice')) {
        console.log(`Provider for ${req.model} rejected tool_choice="${tc}"; trying fallback`);
        if (tc === 'required') workingToolChoice = 'auto';
        continue;
      }
      throw new Error(`OpenRouter returned status ${response.status}: ${lastErrText}`);
    }

    if (!response || !response.ok) {
      throw new Error(`OpenRouter returned status ${lastStatus}: ${lastErrText}`);
    }
    if (!response.body) throw new Error('OpenRouter returned an empty body');
    yield* sseChatDeltas(response.body);
  };
}
