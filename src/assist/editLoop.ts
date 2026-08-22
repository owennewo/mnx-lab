// The self-correcting edit loop. It lives in `assist/` — not the Worker —
// because the loop is about SELF-CORRECTION, not about who holds the key:
// the same function runs server-side against the deployment's demo key and
// browser-side against the user's own BYOK key (core-assist-byok.md). What
// differs is the `ChatTransport` handed in.
//
// Factored for future evals (harness/evals/) too: pure async function in,
// protocol frames out through a callback. No Hono, no streams, no env access,
// no DOM, no fetch of its own.
//
// One iteration: ask the transport for a forced `update_document` tool call,
// consume its deltas (surfacing token counts as progress), parse the
// accumulated arguments, then validate TWICE — the official MNX schema and
// every `_x.mnxLab` vendor dict against the extension schema. On failure the
// assistant's failed tool_calls message plus a synthetic role:'tool' error
// response are appended to the conversation and the model is re-invoked, up
// to maxAttempts. Both validators are precompiled (spec/tools/
// compile-validator.mjs) because Workers disallow runtime codegen — and the
// PUBLISHED schema only: the LLM must never be taught proposed-schema fields.
import { buildEditSystemPrompt } from './prompts/editNotation.ts';
import type { DoneFrame, ProgressFrame, SelectionContextPayload } from './protocol.ts';

/** OpenAI-style forced-tool setting. The loop never sets it — the transport
 *  owns the value and any provider fallback — but the type belongs with the
 *  request shape. */
export type ToolChoice = 'required' | 'auto';

export interface ChatCompletionRequest {
  model: string;
  messages: unknown[];
  tools: unknown[];
  signal?: AbortSignal;
}

/** What the loop needs from the outside world, and all it needs: one
 *  streaming tool-capable completion. Declared HERE, by the consumer, so the
 *  loop depends on no particular provider — `openRouterEditTransport` in
 *  openrouter.ts is the implementation, and a test can hand over a generator
 *  with no network at all. */
export type ChatTransport = (req: ChatCompletionRequest) => AsyncGenerator<{
  content?: string;
  toolCallId?: string;
  toolArguments?: string;
  completionTokens?: number;
}>;

/** The precompiled validators, loaded on FIRST USE rather than at module
 *  scope: in the browser they are a ~196 kB chunk that only an actual edit
 *  needs, and the same lazy import keeps them out of the workbench's initial
 *  bundle (model/pinnedErrors.ts loads the same chunk the same way). In the
 *  Worker this resolves once at first request and is cached thereafter. */
export interface EditValidators {
  validateMnx: ((data: unknown) => boolean) & { errors: any[] | null };
  validateNoteExt: ((data: unknown) => boolean) & { errors: any[] | null };
  validatePartExt: ((data: unknown) => boolean) & { errors: any[] | null };
  validateGlobalMeasureExt: ((data: unknown) => boolean) & { errors: any[] | null };
}

let validatorsPromise: Promise<EditValidators> | null = null;

export function loadEditValidators(): Promise<EditValidators> {
  validatorsPromise ??= (async () => {
    const [mnx, ext] = await Promise.all([
      import('../../worker/generated/validate-mnx.mjs'),
      import('../../worker/generated/validate-extensions.mjs')
    ]);
    return {
      validateMnx: mnx.default as EditValidators['validateMnx'],
      validateNoteExt: ext.validateNoteExt as EditValidators['validateNoteExt'],
      validatePartExt: ext.validatePartExt as EditValidators['validatePartExt'],
      validateGlobalMeasureExt: ext.validateGlobalMeasureExt as EditValidators['validateGlobalMeasureExt']
    };
  })();
  return validatorsPromise;
}

export interface EditLoopInput {
  userPrompt: string;
  mnxJson: unknown;
  selectionContext: SelectionContextPayload;
  model: string;
  attachedImages?: string[];
  /** How the loop talks to a model. The key lives in here, never in the loop. */
  transport: ChatTransport;
  onProgress: (frame: ProgressFrame) => void | Promise<void>;
  maxAttempts?: number;
  signal?: AbortSignal;
}

/**
 * Deliberately filters `anyOf`/`oneOf`/`allOf` noise and keeps only the first
 * `sequence-content/items/anyOf/0` branch (the `event` shape) so the LLM gets
 * actionable feedback. Don't "fix" this by re-enabling all branches — it
 * makes the errors unusable.
 */
export function formatValidationErrors(errors: any[]): string {
  const formatted: string[] = [];
  const seen = new Set<string>();

  for (const err of errors) {
    if (err.keyword === 'anyOf' || err.keyword === 'oneOf' || err.keyword === 'allOf') {
      continue;
    }

    // Alternative matching branches in sequence-content anyOf —
    // 0: event, 1: grace, 2: tuplet, 3: space, 4: tremolo
    if (err.schemaPath && err.schemaPath.includes('sequence-content/items/anyOf/')) {
      const match = err.schemaPath.match(/sequence-content\/items\/anyOf\/(\d+)/);
      if (match && parseInt(match[1], 10) > 0) {
        continue;
      }
    }

    let msg = '';
    if (err.keyword === 'unevaluatedProperties') {
      const prop = err.params.unevaluatedProperty;
      msg = `Property "${prop}" is not allowed at path "${err.instancePath}".`;
      if (prop === 'note') {
        msg += ` (Note: The MNX schema requires the plural "notes" array containing note objects, not a singular "note" object).`;
      }
    } else if (err.keyword === 'additionalProperties') {
      const prop = err.params.additionalProperty;
      msg = `Property "${prop}" is not allowed at path "${err.instancePath}".`;
    } else if (err.keyword === 'required') {
      msg = `Path "${err.instancePath}" is missing required property "${err.params.missingProperty}".`;
    } else {
      msg = `Path "${err.instancePath}" ${err.message}.`;
    }

    if (!seen.has(msg)) {
      seen.add(msg);
      formatted.push(msg);
    }
  }

  return formatted.slice(0, 5).join('\n');
}

/**
 * Second validation verdict: every `_x.mnxLab` vendor dict in the document
 * against the extension schema (docs/mnx-extensions.md). Standard MNX
 * validity is deliberately blind to `_x` content, so this is a separate walk.
 * Returns formatted error strings (empty array = extension-valid).
 */
export function validateLabExtensions(doc: any, v: EditValidators): string[] {
  const errors: string[] = [];
  const report = (path: string, subErrors: any[] | null) => {
    for (const err of subErrors ?? []) {
      errors.push(`MNX Lab extension: path "${path}${err.instancePath}" ${err.message}.`);
    }
  };

  (doc?.global?.measures ?? []).forEach((measure: any, mIdx: number) => {
    if (measure?._x?.mnxLab !== undefined && !v.validateGlobalMeasureExt(measure._x.mnxLab)) {
      report(`/global/measures/${mIdx}/_x/mnxLab`, v.validateGlobalMeasureExt.errors);
    }
  });

  (doc?.parts ?? []).forEach((part: any, pIdx: number) => {
    if (part?._x?.mnxLab !== undefined && !v.validatePartExt(part._x.mnxLab)) {
      report(`/parts/${pIdx}/_x/mnxLab`, v.validatePartExt.errors);
    }
    (part?.measures ?? []).forEach((measure: any, mIdx: number) => {
      (measure?.sequences ?? []).forEach((seq: any, sIdx: number) => {
        (seq?.content ?? []).forEach((event: any, eIdx: number) => {
          (event?.notes ?? []).forEach((note: any, nIdx: number) => {
            if (note?._x?.mnxLab !== undefined && !v.validateNoteExt(note._x.mnxLab)) {
              report(
                `/parts/${pIdx}/measures/${mIdx}/sequences/${sIdx}/content/${eIdx}/notes/${nIdx}/_x/mnxLab`,
                v.validateNoteExt.errors
              );
            }
          });
        });
      });
    });
  });

  return errors.slice(0, 5);
}

const EDIT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'update_document',
      description:
        'Replaces the active MNX JSON document with a new, fully-modified version. Always call this tool exactly once.',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description:
              'The COMPLETE, updated W3C MNX JSON document. Must be the full document, not a partial or empty object.'
          },
          notes: {
            type: 'string',
            description:
              'A brief explanation of what was changed, or why the instruction could not be completed.'
          }
        },
        required: ['data', 'notes']
      }
    }
  }
];

/** Runs the loop to completion and returns the done frame (never throws). */
export async function runEditLoop(input: EditLoopInput): Promise<DoneFrame> {
  const {
    userPrompt,
    mnxJson,
    selectionContext,
    model,
    attachedImages = [],
    transport,
    onProgress,
    maxAttempts = 3,
    signal
  } = input;

  const validators = await loadEditValidators();

  const userText = `Current MNX Score:\n${JSON.stringify(mnxJson, null, 2)}\n\nEditor selection state:\n${JSON.stringify(selectionContext)}\n\nUser Instruction:\n${userPrompt}`;

  const hasImages = Array.isArray(attachedImages) && attachedImages.length > 0;
  const userContent = hasImages
    ? [
        { type: 'text', text: userText },
        ...attachedImages.map((url: string) => ({ type: 'image_url', image_url: { url } }))
      ]
    : userText;

  const messages: any[] = [
    { role: 'system', content: buildEditSystemPrompt(selectionContext) },
    { role: 'user', content: userContent }
  ];

  let attempt = 0;
  let validationErrors: string | null = null;
  let toolCallId: string | null = null;
  let notes = '';
  let updatedMnxJson: any = null;
  let tokensEst = 0;
  // assistantContent is the model's free-text response (delta.content). Most of
  // the time it's empty because the model goes straight to the tool call, but
  // some models (or non-vision models receiving an image) emit text instead.
  let assistantContent = '';

  while (attempt < maxAttempts) {
    const retryStatus =
      attempt > 0 ? `retrying self-correction, attempt ${attempt}/${maxAttempts - 1}...` : null;
    await onProgress(
      retryStatus
        ? { type: 'progress', tokens: tokensEst, status: retryStatus }
        : { type: 'progress', tokens: 0, status: 'thinking...' }
    );

    try {
      let accumulatedArguments = '';
      toolCallId = null;
      assistantContent = '';

      for await (const delta of transport({
        model,
        messages,
        tools: EDIT_TOOLS,
        signal
      })) {
        if (delta.completionTokens) {
          tokensEst = delta.completionTokens;
          await onProgress({
            type: 'progress',
            tokens: tokensEst,
            status: retryStatus ?? 'generating...'
          });
          continue;
        }
        if (delta.content) assistantContent += delta.content;
        if (delta.toolCallId) toolCallId = delta.toolCallId;
        if (delta.toolArguments) {
          accumulatedArguments += delta.toolArguments;
          tokensEst = Math.max(tokensEst + 1, Math.floor(accumulatedArguments.length / 4));
          await onProgress({
            type: 'progress',
            tokens: tokensEst,
            status: retryStatus ?? 'generating...'
          });
        }
      }

      if (accumulatedArguments.trim() === '') {
        return {
          type: 'done',
          success: true,
          explanation: 'Completed instruction (no edits made).',
          updatedMnxJson: mnxJson,
          messages,
          toolCallArguments: '',
          assistantContent,
          attemptsUsed: attempt + 1
        };
      }

      validationErrors = null;
      let argumentsObj: any = null;
      try {
        argumentsObj = JSON.parse(accumulatedArguments);
      } catch (e: any) {
        validationErrors = `Failed to parse tool call arguments as JSON: ${e.message}. Please ensure you return valid JSON.`;
      }

      if (argumentsObj) {
        notes = argumentsObj.notes || 'No notes provided.';
        updatedMnxJson = argumentsObj.data;

        if (typeof updatedMnxJson === 'string') {
          try {
            if (updatedMnxJson.trim() !== '') {
              updatedMnxJson = JSON.parse(updatedMnxJson);
            } else {
              updatedMnxJson = null;
            }
          } catch (e: any) {
            validationErrors = `Failed to parse updatedMnxJson string: ${e.message}. Please ensure the 'data' field is a valid JSON object matching the MNX schema.`;
            updatedMnxJson = null;
          }
        }

        if (!validationErrors) {
          if (!updatedMnxJson || !updatedMnxJson.parts || updatedMnxJson.parts.length === 0) {
            validationErrors = 'JSON structure is missing required root properties "mnx" or "parts".';
          } else {
            // Two verdicts: standard MNX schema, then the extension schema
            // over every `_x.mnxLab` dict. Both gate the retry loop.
            const isValid = validators.validateMnx(updatedMnxJson);
            if (!isValid) {
              validationErrors = formatValidationErrors(validators.validateMnx.errors || []);
            } else {
              const extErrors = validateLabExtensions(updatedMnxJson, validators);
              if (extErrors.length > 0) {
                validationErrors = extErrors.join('\n');
              }
            }
          }
        }
      }

      if (!validationErrors) {
        return {
          type: 'done',
          success: true,
          explanation: notes,
          updatedMnxJson,
          messages,
          toolCallArguments: accumulatedArguments,
          assistantContent,
          attemptsUsed: attempt + 1
        };
      }

      // Validation failed — append the failed call + synthetic tool error and retry.
      console.warn(`Validation failed on attempt ${attempt + 1}:`, validationErrors);

      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: toolCallId || `call_err_${attempt}`,
            type: 'function',
            function: { name: 'update_document', arguments: accumulatedArguments }
          }
        ]
      });

      messages.push({
        role: 'tool',
        tool_call_id: toolCallId || `call_err_${attempt}`,
        name: 'update_document',
        content: JSON.stringify({
          success: false,
          error: `MNX JSON Schema Validation failed:\n${validationErrors}\n\nPlease correct the document structure (for example, ensure you use the plural "notes" array inside events, and do not place "note" objects or direct pitch attributes on events). Return the COMPLETE corrected document.`
        })
      });

      attempt++;
    } catch (error: any) {
      console.error(`Error on attempt ${attempt + 1}:`, error);
      if (attempt >= maxAttempts - 1) {
        return {
          type: 'done',
          success: false,
          error: error.message,
          messages,
          assistantContent,
          attemptsUsed: attempt + 1
        };
      }
      attempt++;
    }
  }

  console.error('Self-correction failed after maximum attempts.');
  return {
    type: 'done',
    success: false,
    error: `Schema validation failed after self-correction retries:\n${validationErrors}`,
    messages,
    assistantContent,
    attemptsUsed: maxAttempts
  };
}
