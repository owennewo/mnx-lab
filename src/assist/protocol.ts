// The chat-to-edit protocol: zero or more progress frames, then exactly one
// done frame.
//
// It is a WIRE protocol only on the demo path, where /api/edit-notation
// streams these as application/x-ndjson. On the ordinary BYOK path the same
// frames are yielded in-process by `runEditLoop` and never serialized — same
// shapes, same iterator, so a caller cannot tell which one it got except by
// reading `demoMode`/`mockMode`. Change shapes here and every side moves
// together.

/** POST body for /api/edit-notation. */
export interface EditRequest {
  userPrompt: string;
  /** The full current MNX document (the loop always works whole-document). */
  mnxJson: unknown;
  /** Editor selection state, injected verbatim into the user message. */
  selectionContext: SelectionContextPayload;
  /** OpenRouter model id; the Worker applies its own default when absent. */
  model?: string;
  /** Ordered fallbacks for that pick — the models the selector ranked below
   *  it. Absent means no chain, which is what every caller sent before
   *  core-assist-model-selector.md's second consumer existed. */
  fallbacks?: string[];
  /** Data-URL images attached to the instruction (vision models only). */
  attachedImages?: string[];
}

export interface SelectionContextPayload {
  selectedNoteIds?: string[];
  [key: string]: unknown;
}

export interface ProgressFrame {
  type: 'progress';
  /** Completion-token estimate so the UI can show life while streaming. */
  tokens: number;
  status?: string;
}

export interface DoneFrame {
  type: 'done';
  success: boolean;
  /** Present on success: the complete, schema-valid updated document. */
  updatedMnxJson?: unknown;
  /** Present on failure. */
  error?: string;
  /** The model's own summary of what changed (its `notes` argument). */
  explanation?: string;
  /** True when the offline mock produced the result (no OpenRouter key). */
  mockMode?: boolean;
  /** True when the WORKER produced the result on the deployment's own key —
   *  the demo path, spending somebody else's money (core-assist-byok.md). A
   *  done frame with neither flag was a browser-direct edit on the user's own
   *  key, which is the ordinary case once they have connected one. */
  demoMode?: boolean;
  attemptsUsed?: number;
  /** Debug surfaces: the conversation and raw tool-call payloads. */
  messages?: unknown[];
  toolCallArguments?: string;
  assistantContent?: string;
}

export type EditFrame = ProgressFrame | DoneFrame;

export function isDoneFrame(frame: EditFrame): frame is DoneFrame {
  return frame.type === 'done';
}
