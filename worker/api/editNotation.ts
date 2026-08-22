// POST /api/edit-notation — the HTTP face of the self-correcting edit loop
// (src/assist/editLoop.ts). Returns an application/x-ndjson stream of
// protocol frames (src/assist/protocol.ts): progress while the LLM generates,
// then a single done frame.
//
// THIS ROUTE IS A DEMO, NOT THE WORKBENCH'S BACKEND (core-assist-byok.md).
// Since BYOK landed, a user with their own OpenRouter key never reaches it:
// the workbench runs the identical loop in the browser with the key it holds.
// What is left here is the visitor who has connected no key of their own, and
// for them the Worker spends somebody else's money — the deployment's. So it
// says so, in the frame: every done frame this route produces is stamped
// `demoMode` (server key) or `mockMode` (no key at all), and the client is
// expected to show which one it got. An unstamped done frame is a
// browser-direct edit and only the user's key paid for it.
import { Hono } from 'hono';
import { runEditLoop } from '../../src/assist/editLoop.ts';
import { openRouterEditTransport } from '../../src/assist/openrouter.ts';
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
        transport: openRouterEditTransport({
          apiKey: env.OPENROUTER_API_KEY,
          referer: 'https://mnx-lab.totai.uk',
          title: 'MNX Lab'
        }),
        onProgress: frame => void send(frame)
      });
      // The demo stamp is the route's, not the loop's: the loop cannot know
      // whose key its transport carries, and should not.
      await send({ ...done, demoMode: true });
    } catch (err: any) {
      console.error('edit-notation stream error:', err);
      try {
        await send({ type: 'done', success: false, error: err?.message || 'Internal error', demoMode: true });
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
