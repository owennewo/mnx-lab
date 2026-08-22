// The self-correcting edit loop, driven with NO NETWORK AT ALL.
//
// This suite is the payoff of moving the loop out of the Worker
// (core-assist-byok.md): `runEditLoop` now takes a `ChatTransport` it
// declares itself, so a test hands it a scripted async generator and reads
// the frames back. Previously the loop reached for `fetch` and OpenRouter's
// URL directly and only a live key could exercise it.
//
// What is under test is the SELF-CORRECTION, which is the loop's whole
// reason to exist: two validation verdicts, the synthetic tool error that
// re-enters the conversation, and the promise that it never throws.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runEditLoop, type ChatTransport } from '../../src/assist/editLoop.ts';
import type { EditFrame, ProgressFrame } from '../../src/assist/protocol.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VALID = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scenarios/spec/hello-world/score.mnx.json'), 'utf8')
);

/** A document that is structurally MNX but wrong in the exact way the prompt
 *  keeps having to correct: singular `note` where the schema says `notes`. */
const SINGULAR_NOTE = (() => {
  const doc = structuredClone(VALID);
  const event = doc.parts[0].measures[0].sequences[0].content[0];
  event.note = event.notes[0];
  delete event.notes;
  return doc;
})();

/** Standard-valid, but the vendor dict is not: `string` must be a number.
 *  The extension schema is a SEPARATE verdict — standard MNX validity is
 *  deliberately blind to `_x` content. */
const BAD_EXTENSION = (() => {
  const doc = structuredClone(VALID);
  doc.parts[0].measures[0].sequences[0].content[0].notes[0]._x = {
    mnxLab: { string: 'the thickest one' }
  };
  return doc;
})();

/** Scripts one transport reply per attempt: the tool-call arguments the model
 *  "returns", streamed in two fragments so the accumulator is exercised. */
function scripted(...replies: unknown[]): { transport: ChatTransport; calls: unknown[][] } {
  const calls: unknown[][] = [];
  let n = 0;
  const transport: ChatTransport = async function* (req) {
    calls.push(req.messages as unknown[]);
    const args = JSON.stringify(replies[Math.min(n, replies.length - 1)]);
    n++;
    const half = Math.ceil(args.length / 2);
    yield { toolCallId: `call_${n}`, toolArguments: args.slice(0, half) };
    yield { toolArguments: args.slice(half) };
    yield { completionTokens: 17 };
  };
  return { transport, calls };
}

async function run(transport: ChatTransport, maxAttempts?: number) {
  const progress: ProgressFrame[] = [];
  const done = await runEditLoop({
    userPrompt: 'make it louder',
    mnxJson: VALID,
    selectionContext: {},
    model: 'test/model',
    transport,
    onProgress: f => void progress.push(f),
    ...(maxAttempts === undefined ? {} : { maxAttempts })
  });
  return { done, progress };
}

describe('the edit loop, over an injected transport', () => {
  it('accepts a valid document on the first attempt and reports progress', async () => {
    const { transport } = scripted({ data: VALID, notes: 'raised the dynamic' });
    const { done, progress } = await run(transport);
    expect(done.success).toBe(true);
    expect(done.attemptsUsed).toBe(1);
    expect(done.explanation).toBe('raised the dynamic');
    expect(done.updatedMnxJson).toEqual(VALID);
    // The usage frame is reported as progress, not swallowed.
    expect(progress.some(f => f.tokens === 17)).toBe(true);
  });

  it('self-corrects: the failed call and a synthetic tool error re-enter the conversation', async () => {
    const { transport, calls } = scripted(
      { data: SINGULAR_NOTE, notes: 'first try' },
      { data: VALID, notes: 'fixed it' }
    );
    const { done } = await run(transport);
    expect(done.success).toBe(true);
    expect(done.attemptsUsed).toBe(2);
    expect(done.explanation).toBe('fixed it');

    // Attempt 2 sees four messages: system, user, the assistant's failed
    // tool_calls, and the role:'tool' error carrying the validator's verdict.
    const second = calls[1] as { role: string; content?: unknown; tool_calls?: unknown[] }[];
    expect(second.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
    expect(String(second[3].content)).toContain('notes');
  });

  it('the extension schema is a second verdict — a standard-valid document can still fail', async () => {
    const { transport, calls } = scripted({ data: BAD_EXTENSION, notes: 'annotated' }, { data: VALID, notes: 'ok' });
    const { done } = await run(transport);
    expect(done.success).toBe(true);
    expect(done.attemptsUsed).toBe(2);
    const err = String((calls[1] as { content?: unknown }[])[3].content);
    expect(err).toContain('MNX Lab extension');
  });

  it('gives up after maxAttempts and says why, rather than returning a bad document', async () => {
    const { transport, calls } = scripted({ data: SINGULAR_NOTE, notes: 'nope' });
    const { done } = await run(transport, 2);
    expect(done.success).toBe(false);
    expect(done.error).toMatch(/validation failed after self-correction/i);
    expect(done.updatedMnxJson).toBeUndefined();
    expect(calls).toHaveLength(2);
  });

  it('an empty tool call is "no edits made", not a failure', async () => {
    const transport: ChatTransport = async function* () {
      yield { content: 'I have nothing to change.' };
    };
    const { done } = await run(transport);
    expect(done.success).toBe(true);
    expect(done.explanation).toBe('Completed instruction (no edits made).');
    expect(done.updatedMnxJson).toEqual(VALID);
    expect(done.assistantContent).toBe('I have nothing to change.');
  });

  it('never throws: a transport failure comes back as a done frame', async () => {
    const transport: ChatTransport = async function* () {
      throw new Error('OpenRouter returned status 401: No auth credentials found');
      // eslint-disable-next-line no-unreachable
      yield {};
    };
    const { done } = await run(transport, 1);
    expect(done.type).toBe('done');
    expect(done.success).toBe(false);
    expect(done.error).toContain('401');
  });

  it('refuses a document with no parts before it ever reaches the schema', async () => {
    const { transport, calls } = scripted({ data: { mnx: { version: 1 } }, notes: 'empty' });
    const { done } = await run(transport, 2);
    expect(done.success).toBe(false);
    expect(String((calls[1] as { content?: unknown }[])[3].content)).toContain('parts');
  });
});

// A tiny guard that the two paths cannot drift: the frames the browser-direct
// path yields are the same union the NDJSON reader parses.
describe('protocol', () => {
  it('a done frame is an EditFrame either way', async () => {
    const { transport } = scripted({ data: VALID, notes: 'x' });
    const { done } = await run(transport);
    const frame: EditFrame = done;
    expect(frame.type).toBe('done');
  });
});

// The claim the whole item rests on: with a key in hand, an edit reaches
// OpenRouter and NOTHING reaches our origin. Global fetch is stubbed so the
// test can see every URL either path would call.
describe('streamEditNotation chooses its path by whether a key is held', () => {
  const sseBody = (args: string) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder();
        c.enqueue(
          enc.encode(
            `data: ${JSON.stringify({
              choices: [{ delta: { tool_calls: [{ id: 'c1', function: { arguments: args } }] } }]
            })}\n\n`
          )
        );
        c.enqueue(enc.encode(`data: ${JSON.stringify({ usage: { completion_tokens: 9 } })}\n\n`));
        c.enqueue(enc.encode('data: [DONE]\n\n'));
        c.close();
      }
    });

  async function withStubbedFetch(impl: typeof fetch, body: () => Promise<void>) {
    const real = globalThis.fetch;
    globalThis.fetch = impl;
    try {
      await body();
    } finally {
      globalThis.fetch = real;
    }
  }

  it('with a key: browser-direct to OpenRouter, no call to /api/edit-notation', async () => {
    const urls: string[] = [];
    const stub = (async (url: string) => {
      urls.push(String(url));
      return new Response(sseBody(JSON.stringify({ data: VALID, notes: 'done' })), { status: 200 });
    }) as unknown as typeof fetch;

    const frames: EditFrame[] = [];
    await withStubbedFetch(stub, async () => {
      const { streamEditNotation } = await import('../../src/assist/stream.ts');
      for await (const f of streamEditNotation(
        { userPrompt: 'x', mnxJson: VALID, selectionContext: {} },
        { apiKey: 'sk-or-v1-mine', referer: 'http://localhost:5173' }
      )) {
        frames.push(f);
      }
    });

    expect(urls).toEqual(['https://openrouter.ai/api/v1/chat/completions']);
    const done = frames.at(-1) as { type: string; success: boolean; demoMode?: boolean; mockMode?: boolean };
    expect(done.type).toBe('done');
    expect(done.success).toBe(true);
    // Neither stamp: the user's own key paid for this one.
    expect(done.demoMode).toBeUndefined();
    expect(done.mockMode).toBeUndefined();
    // Progress arrived before the done frame, not batched behind it.
    expect(frames.filter(f => f.type === 'progress').length).toBeGreaterThan(0);
    expect(frames.findIndex(f => f.type === 'done')).toBe(frames.length - 1);
  });

  it('without a key: the Worker route, which is the demo path', async () => {
    const urls: string[] = [];
    const stub = (async (url: string) => {
      urls.push(String(url));
      return new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'done', success: true, demoMode: true }) + '\n'));
            c.close();
          }
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const frames: EditFrame[] = [];
    await withStubbedFetch(stub, async () => {
      const { streamEditNotation } = await import('../../src/assist/stream.ts');
      for await (const f of streamEditNotation({ userPrompt: 'x', mnxJson: VALID, selectionContext: {} })) {
        frames.push(f);
      }
    });

    expect(urls).toEqual(['/api/edit-notation']);
    expect(frames).toEqual([{ type: 'done', success: true, demoMode: true }]);
  });
});
