// POST /api/edit-notation — the HTTP face of the self-correcting edit loop
// (worker/editLoop.ts). Returns an application/x-ndjson stream of protocol
// frames (src/assist/protocol.ts): progress while the LLM generates, then a
// single done frame. With no OpenRouter key configured, falls back to the
// shared offline mock so the UI stays demoable.
import { Hono } from 'hono';
import { runEditLoop } from '../editLoop.ts';
import { handleMockCommand } from '../../src/assist/mock.ts';
import type { EditRequest } from '../../src/assist/protocol.ts';
import type { Env } from '../env.ts';

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

function hasApiKey(env: Env): env is Env & { OPENROUTER_API_KEY: string } {
  const key = env.OPENROUTER_API_KEY;
  return !!key && !key.startsWith('YOUR_');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const editNotation = new Hono<{ Bindings: Env }>().post('/', async c => {
  const body = (await c.req.json()) as EditRequest;
  const { userPrompt, mnxJson, selectionContext, model = DEFAULT_MODEL, attachedImages } = body;
  const env = c.env;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = (obj: unknown) => writer.write(encoder.encode(JSON.stringify(obj) + '\n'));

  const run = async () => {
    try {
      if (!hasApiKey(env)) {
        console.log('No OpenRouter key found. Performing local mock modification.');
        const explanation = handleMockCommand(userPrompt, mnxJson, selectionContext);
        let tokens = 0;
        while (true) {
          await sleep(400);
          tokens += Math.floor(Math.random() * 8) + 4;
          await send({ type: 'progress', tokens });
          if (tokens > 100) break;
        }
        await send({
          type: 'done',
          success: true,
          explanation,
          updatedMnxJson: mnxJson,
          mockMode: true
        });
        return;
      }

      const done = await runEditLoop({
        userPrompt,
        mnxJson,
        selectionContext,
        model,
        attachedImages,
        apiKey: env.OPENROUTER_API_KEY,
        onProgress: frame => void send(frame)
      });
      await send(done);
    } catch (err: any) {
      console.error('edit-notation stream error:', err);
      try {
        await send({ type: 'done', success: false, error: err?.message || 'Internal error' });
      } catch {
        // Stream already broken; nothing more to do.
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // Already closed.
      }
    }
  };

  c.executionCtx.waitUntil(run());

  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson' }
  });
});
