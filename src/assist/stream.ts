// Client-side reader for the /api/edit-notation NDJSON stream.
// Framework-free: the shell consumes the async iterator and renders
// progress however it likes.
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

/**
 * POSTs an edit request and yields protocol frames until the done frame.
 * Throws on transport errors; protocol-level failure arrives as
 * `{type: 'done', success: false}`.
 */
export async function* streamEditNotation(
  request: EditRequest,
  init?: { endpoint?: string; signal?: AbortSignal }
): AsyncGenerator<EditFrame> {
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
