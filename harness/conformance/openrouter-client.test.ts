// The browser-direct OpenRouter client's pure halves (core-assist-byok.md):
// the PKCE challenge derivation and the SSE delta parser. Both run on Node's
// WebCrypto/streams, so they test without a browser or a network — the
// setup-grammar precedent. The redirect and the storage are shell code and
// are covered by the hands-on pass.
import { describe, expect, it } from 'vitest';
import {
  exchangePkceCode,
  pkceAuthorizeUrl,
  pkceChallenge,
  sseTextDeltas,
  streamChat
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
});
