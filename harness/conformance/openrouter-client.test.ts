// The browser-direct OpenRouter client's pure halves (core-assist-byok.md):
// the PKCE challenge derivation and the SSE delta parser. Both run on Node's
// WebCrypto/streams, so they test without a browser or a network — the
// setup-grammar precedent. The redirect and the storage are shell code and
// are covered by the hands-on pass.
import { describe, expect, it } from 'vitest';
import {
  exchangePkceCode,
  openRouterEditTransport,
  pkceAuthorizeUrl,
  pkceChallenge,
  sseTextDeltas,
  streamChat,
  type ChatDelta
} from '../../src/assist/openrouter.ts';

function stream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    }
  });
}

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const d of gen) out.push(d);
  return out;
}

describe('PKCE', () => {
  it('derives the RFC 7636 S256 challenge (appendix B vector)', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });

  it('builds the authorize URL with the callback and S256 method', () => {
    const u = new URL(pkceAuthorizeUrl('http://localhost:5174/', 'abc'));
    expect(u.origin + u.pathname).toBe('https://openrouter.ai/auth');
    expect(u.searchParams.get('callback_url')).toBe('http://localhost:5174/');
    expect(u.searchParams.get('code_challenge')).toBe('abc');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('exchanges a code for a key and refuses a keyless response', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ key: 'sk-or-v1-test' }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await exchangePkceCode('CODE', 'VERIFIER', ok)).toBe('sk-or-v1-test');
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/auth/keys');
    expect(calls[0].body).toEqual({ code: 'CODE', code_verifier: 'VERIFIER', code_challenge_method: 'S256' });

    const empty = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    await expect(exchangePkceCode('CODE', 'VERIFIER', empty)).rejects.toThrow(/no key/);
  });
});

describe('SSE deltas', () => {
  const frame = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

  it('yields content deltas and stops at [DONE]', async () => {
    const s = stream([frame('Hel'), frame('lo'), 'data: [DONE]\n\n', frame('never')]);
    expect(await collect(sseTextDeltas(s))).toEqual(['Hel', 'lo']);
  });

  it('reassembles frames split across chunks and skips keepalive comments', async () => {
    const whole = ': OPENROUTER PROCESSING\n\n' + frame('ab') + frame('cd');
    const s = stream([whole.slice(0, 17), whole.slice(17, 40), whole.slice(40)]);
    expect(await collect(sseTextDeltas(s))).toEqual(['ab', 'cd']);
  });

  it('surfaces an in-stream error frame as a throw', async () => {
    const s = stream([frame('x'), `data: ${JSON.stringify({ error: { message: 'rate limited' } })}\n\n`]);
    await expect(collect(sseTextDeltas(s))).rejects.toThrow(/rate limited/);
  });

  it('streamChat sends bearer + attribution headers and relays HTTP errors', async () => {
    let seen: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      seen = init;
      return new Response(stream([frame('ok'), 'data: [DONE]\n\n']), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await collect(
      streamChat({ apiKey: 'K', model: 'm', messages: [{ role: 'user', content: 'hi' }], referer: 'http://x', title: 'T', fetchImpl })
    );
    expect(out).toEqual(['ok']);
    const h = seen!.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer K');
    expect(h['HTTP-Referer']).toBe('http://x');
    expect(JSON.parse(String(seen!.body))).toMatchObject({ model: 'm', stream: true });

    const denied = (async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 })) as unknown as typeof fetch;
    await expect(collect(streamChat({ apiKey: 'K', model: 'm', messages: [], fetchImpl: denied }))).rejects.toThrow(/401 — bad key/);
  });

  // The selector's ranked output IS the fallback chain
  // (core-assist-model-selector.md's second consumer).
  it('a fallback chain replaces `model` with an ordered `models`, pick first', async () => {
    let seen: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      seen = init;
      return new Response(stream([frame('ok'), 'data: [DONE]\n\n']), { status: 200 });
    }) as unknown as typeof fetch;
    await collect(
      streamChat({ apiKey: 'K', model: 'first', fallbacks: ['second', 'third'], messages: [], fetchImpl })
    );
    const body = JSON.parse(String(seen!.body));
    expect(body.models).toEqual(['first', 'second', 'third']);
    expect(body.model).toBeUndefined();

    // An empty chain must not change the request at all — the fallback array
    // is the second consumer's feature, not a new default.
    await collect(streamChat({ apiKey: 'K', model: 'solo', fallbacks: [], messages: [], fetchImpl }));
    const plain = JSON.parse(String(seen!.body));
    expect(plain).toMatchObject({ model: 'solo' });
    expect(plain.models).toBeUndefined();
  });

  it('reports the model that actually served, once, from the first frame that names it', async () => {
    const named = (content: string, model?: string) =>
      `data: ${JSON.stringify({ ...(model ? { model } : {}), choices: [{ delta: { content } }] })}\n\n`;
    const served: string[] = [];
    const fetchImpl = (async () =>
      new Response(stream([named('a', 'second'), named('b', 'second'), 'data: [DONE]\n\n']), {
        status: 200
      })) as unknown as typeof fetch;
    const out = await collect(
      streamChat({
        apiKey: 'K',
        model: 'first',
        fallbacks: ['second'],
        messages: [],
        onModel: id => served.push(id),
        fetchImpl
      })
    );
    expect(out).toEqual(['a', 'b']);
    // Once, not per frame: it is a fact about the stream, not about the text.
    expect(served).toEqual(['second']);
  });
});

// The edit loop's transport. Same client, one face further on: tool-call and
// usage deltas the plain chat drops, plus the tool_choice fallback that used
// to live inside the loop (core-assist-byok.md — the loop declares
// `ChatTransport`, this file implements it, and the provider quirk belongs
// with the provider).
describe('the edit transport', () => {
  const toolFrame = (args: string, id?: string) =>
    `data: ${JSON.stringify({
      choices: [{ delta: { tool_calls: [{ ...(id ? { id } : {}), function: { arguments: args } }] } }]
    })}\n\n`;

  const sse = (...frames: string[]) =>
    (async () => new Response(stream([...frames, 'data: [DONE]\n\n']), { status: 200 })) as unknown as typeof fetch;

  async function drain(t: ReturnType<typeof openRouterEditTransport>, model = 'm') {
    const out: ChatDelta[] = [];
    for await (const d of t({ model, messages: [], tools: [] })) out.push(d);
    return out;
  }

  it('yields tool-call id, argument fragments and the usage frame', async () => {
    const t = openRouterEditTransport({
      apiKey: 'k',
      fetchImpl: sse(
        toolFrame('{"data":', 'call_1'),
        toolFrame('{}}'),
        `data: ${JSON.stringify({ usage: { completion_tokens: 42 } })}\n\n`
      )
    });
    expect(await drain(t)).toEqual([
      { toolCallId: 'call_1', toolArguments: '{"data":' },
      { toolArguments: '{}}' },
      { completionTokens: 42 }
    ]);
  });

  it('falls back required → auto on a tool_choice 404, and memoizes the survivor', async () => {
    const sent: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const tc = JSON.parse(String(init.body)).tool_choice as string;
      sent.push(tc);
      if (tc === 'required') return new Response('no tool_choice for you', { status: 404 });
      return new Response(stream([toolFrame('{}'), 'data: [DONE]\n\n']), { status: 200 });
    }) as unknown as typeof fetch;

    const t = openRouterEditTransport({ apiKey: 'k', fetchImpl });
    await drain(t);
    expect(sent).toEqual(['required', 'auto']);
    // The second call must not re-pay the discovery: the closure remembers.
    await drain(t);
    expect(sent).toEqual(['required', 'auto', 'auto']);
  });

  it('does NOT retry a non-tool_choice failure — the cause is reported as-is', async () => {
    const sent: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)).tool_choice as string);
      return new Response('No auth credentials found', { status: 401 });
    }) as unknown as typeof fetch;
    await expect(drain(openRouterEditTransport({ apiKey: 'bad', fetchImpl }))).rejects.toThrow(
      /status 401.*No auth credentials/s
    );
    expect(sent).toEqual(['required']);
  });

  it('carries the bearer key and attribution the user will see in their own log', async () => {
    let headers: Record<string, string> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      headers = init.headers as Record<string, string>;
      return new Response(stream(['data: [DONE]\n\n']), { status: 200 });
    }) as unknown as typeof fetch;
    await drain(
      openRouterEditTransport({ apiKey: 'sk-or-v1-mine', referer: 'http://localhost:5173', title: 'MNX Lab', fetchImpl })
    );
    expect(headers.Authorization).toBe('Bearer sk-or-v1-mine');
    expect(headers['HTTP-Referer']).toBe('http://localhost:5173');
    expect(headers['X-Title']).toBe('MNX Lab');
  });
});
