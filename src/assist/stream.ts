// The one call site for an AI edit — and the seam where BYOK removed the
// backend (core-assist-byok.md).
//
// `streamEditNotation` yields protocol frames from whichever of two paths
// applies, and the caller cannot tell them apart:
//
//   with a key  — the self-correcting loop runs IN THIS BROWSER against
//                 OpenRouter, on the user's own key. No Worker, no request to
//                 our origin, nothing of the edit leaving for a server we run.
//   without one — POST to /api/edit-notation, where the Worker spends the
//                 deployment's key (or the offline mock, if it has none). The
//                 done frame is stamped `demoMode`/`mockMode` accordingly.
//
// Framework-free on purpose: the shell consumes the async iterator and renders
// progress however it likes. The UI that will call this is
// roadmap/proposed/low-priority/core-editor-ai-prompt.md's; this is the surface it consumes.
import { runEditLoop } from './editLoop.ts';
import { openRouterEditTransport } from './openrouter.ts';
import type { EditFrame, EditRequest } from './protocol.ts';

/** Splits a byte stream on newlines and yields each parsed frame. */
export async function* readEditFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<EditFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) yield JSON.parse(trimmed) as EditFrame;
      }
    }
    if (done) break;
  }
  const tail = buffer.trim();
  if (tail) yield JSON.parse(tail) as EditFrame;
}

export interface EditStreamOptions {
  /** The user's own OpenRouter key. Present ⇒ browser-direct, no Worker. */
  apiKey?: string;
  endpoint?: string;
  signal?: AbortSignal;
  /** Attribution OpenRouter shows in the user's own activity log. Defaults to
   *  the page's origin, so a local run is distinguishable from production. */
  referer?: string;
}

/**
 * Yields protocol frames until the done frame. Throws on transport errors;
 * protocol-level failure arrives as `{type: 'done', success: false}` from
 * either path — `runEditLoop` is documented never to throw.
 */
export async function* streamEditNotation(
  request: EditRequest,
  init?: EditStreamOptions
): AsyncGenerator<EditFrame> {
  if (init?.apiKey) {
    yield* runEditLoopFrames(request, init.apiKey, init);
    return;
  }
  const response = await fetch(init?.endpoint ?? '/api/edit-notation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: init?.signal
  });
  if (!response.ok || !response.body) {
    throw new Error(`edit-notation request failed: ${response.status}`);
  }
  yield* readEditFrames(response.body);
}

/** The browser-direct path. `runEditLoop` reports progress through a callback
 *  rather than yielding, so the frames are queued here and drained between
 *  awaits — the loop stays callback-shaped for the evals harness while this
 *  presents the same iterator the NDJSON path does. */
async function* runEditLoopFrames(
  request: EditRequest,
  apiKey: string,
  init: EditStreamOptions
): AsyncGenerator<EditFrame> {
  const pending: EditFrame[] = [];
  let wake: (() => void) | null = null;
  const push = (frame: EditFrame) => {
    pending.push(frame);
    wake?.();
  };

  const done = runEditLoop({
    userPrompt: request.userPrompt,
    mnxJson: request.mnxJson,
    selectionContext: request.selectionContext,
    model: request.model ?? DEFAULT_MODEL,
    fallbacks: request.fallbacks,
    attachedImages: request.attachedImages,
    transport: openRouterEditTransport({
      apiKey,
      referer: init.referer ?? pageOrigin(),
      title: 'MNX Lab'
    }),
    onProgress: push,
    signal: init.signal
  });

  let finished = false;
  void done.then(() => {
    finished = true;
    wake?.();
  });

  while (!finished || pending.length) {
    while (pending.length) yield pending.shift()!;
    if (finished) break;
    await new Promise<void>(resolve => {
      wake = resolve;
    });
    wake = null;
  }
  yield await done;
}

/** Mirrors the Worker route's default so both paths pick the same model when
 *  the request names none. */
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

/** Read off `globalThis` rather than the DOM's `location`: src/assist/ is
 *  compiled under the Worker's DOM-free lib as well as the app's, so this
 *  module may not assume a document exists. */
function pageOrigin(): string | undefined {
  return (globalThis as { location?: { origin?: string } }).location?.origin;
}
