// The chat-to-edit wire protocol, shared verbatim by the Worker (producer)
// and the workbench assist client (consumer). /api/edit-notation streams
// application/x-ndjson: zero or more progress frames, then exactly one done
// frame. Change shapes here and both sides move together.

/** POST body for /api/edit-notation. */
export interface EditRequest {
  userPrompt: string;
  /** The full current MNX document (the loop always works whole-document). */
  mnxJson: unknown;
  /** Editor selection state, injected verbatim into the user message. */
  selectionContext: SelectionContextPayload;
  /** OpenRouter model id; the Worker applies its own default when absent. */
  model?: string;
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
