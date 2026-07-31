// The self-correcting edit loop, factored out of the route so future evals
// (harness/evals/) can drive it directly: pure async function in, protocol
// frames out through a callback. No Hono, no streams, no env access here.
//
// One iteration: call OpenRouter with a forced `update_document` tool call,
// stream the response (surfacing token counts as progress), parse the
// accumulated arguments, then validate TWICE — the official MNX schema and
// every `_x.mnxLab` vendor dict against the extension schema. On failure the
// assistant's failed tool_calls message plus a synthetic role:'tool' error
// response are appended to the conversation and the model is re-invoked, up
// to maxAttempts. Both validators are precompiled (spec/tools/
// compile-validator.mjs) because Workers disallow runtime codegen — and the
// PUBLISHED schema only: the LLM must never be taught proposed-schema fields.
import { buildEditSystemPrompt } from './prompts/editNotation.ts';
import validateMnx from './generated/validate-mnx.mjs';
import {
  validateNoteExt,
  validatePartExt,
  validateGlobalMeasureExt
} from './generated/validate-extensions.mjs';
import type { DoneFrame, ProgressFrame, SelectionContextPayload } from '../src/assist/protocol.ts';

export interface EditLoopInput {
  userPrompt: string;
  mnxJson: unknown;
  selectionContext: SelectionContextPayload;
  model: string;
  attachedImages?: string[];
  apiKey: string;
  onProgress: (frame: ProgressFrame) => void | Promise<void>;
  maxAttempts?: number;
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
export function validateLabExtensions(doc: any): string[] {
  const errors: string[] = [];
  const report = (path: string, subErrors: any[] | null) => {
    for (const err of subErrors ?? []) {
      errors.push(`MNX Lab extension: path "${path}${err.instancePath}" ${err.message}.`);
    }
  };

  (doc?.global?.measures ?? []).forEach((measure: any, mIdx: number) => {
    if (measure?._x?.mnxLab !== undefined && !validateGlobalMeasureExt(measure._x.mnxLab)) {
      report(`/global/measures/${mIdx}/_x/mnxLab`, validateGlobalMeasureExt.errors);
    }
  });

  (doc?.parts ?? []).forEach((part: any, pIdx: number) => {
    if (part?._x?.mnxLab !== undefined && !validatePartExt(part._x.mnxLab)) {
      report(`/parts/${pIdx}/_x/mnxLab`, validatePartExt.errors);
    }
    (part?.measures ?? []).forEach((measure: any, mIdx: number) => {
      (measure?.sequences ?? []).forEach((seq: any, sIdx: number) => {
        (seq?.content ?? []).forEach((event: any, eIdx: number) => {
          (event?.notes ?? []).forEach((note: any, nIdx: number) => {
            if (note?._x?.mnxLab !== undefined && !validateNoteExt(note._x.mnxLab)) {
              report(
                `/parts/${pIdx}/measures/${mIdx}/sequences/${sIdx}/content/${eIdx}/notes/${nIdx}/_x/mnxLab`,
                validateNoteExt.errors
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
    apiKey,
    onProgress,
    maxAttempts = 3
  } = input;

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
  // OpenAI-style "required" forces a tool call but some OpenRouter providers
  // (e.g. Qwen) reject any non-default tool_choice with a 404. Start
  // optimistic; memoize the working value across retries within this request.
  let workingToolChoice = 'required';

  while (attempt < maxAttempts) {
    const retryStatus =
      attempt > 0 ? `retrying self-correction, attempt ${attempt}/${maxAttempts - 1}...` : null;
    await onProgress(
      retryStatus
        ? { type: 'progress', tokens: tokensEst, status: retryStatus }
        : { type: 'progress', tokens: 0, status: 'thinking...' }
    );

    try {
      const apiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mnx-lab.totai.uk',
        'X-Title': 'MNX Lab'
      };
      const buildBody = (tc: string) =>
        JSON.stringify({ model, messages, tools: EDIT_TOOLS, tool_choice: tc, stream: true });

      // Try the memoized working tool_choice first. If we haven't fallen back
      // yet (still 'required'), fall back to 'auto' on a tool_choice-specific 404.
      const toolChoicesToTry =
        workingToolChoice === 'required' ? ['required', 'auto'] : [workingToolChoice];
      let response: Response | null = null;
      let lastErrText: string | null = null;
      let lastStatus: number | null = null;
      for (const tc of toolChoicesToTry) {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: apiHeaders,
          body: buildBody(tc)
        });
        if (response.ok) {
          workingToolChoice = tc;
          break;
        }
        const errText = await response.text();
        lastErrText = errText;
        lastStatus = response.status;
        // Only fall through to the next value if this was specifically a
        // tool_choice rejection. Anything else (auth, model-not-found, rate
        // limit) bubbles up immediately.
        if (response.status === 404 && errText.includes('tool_choice')) {
          console.log(`Provider for ${model} rejected tool_choice="${tc}"; trying fallback`);
          if (tc === 'required') workingToolChoice = 'auto';
          continue;
        }
        throw new Error(`OpenRouter returned status ${response.status}: ${errText}`);
      }
      if (!response || !response.ok) {
        throw new Error(`OpenRouter returned status ${lastStatus}: ${lastErrText}`);
      }

      let accumulatedArguments = '';
      toolCallId = null;
      assistantContent = '';

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              try {
                const dataJson = JSON.parse(trimmed.slice(6));

                if (dataJson.usage?.completion_tokens) {
                  tokensEst = dataJson.usage.completion_tokens;
                  await onProgress({
                    type: 'progress',
                    tokens: tokensEst,
                    status: retryStatus ?? 'generating...'
                  });
                  continue;
                }

                const choice = dataJson.choices?.[0];
                const delta = choice?.delta;
                const toolCall = delta?.tool_calls?.[0];

                if (delta?.content) {
                  assistantContent += delta.content;
                }

                if (toolCall?.id) {
                  toolCallId = toolCall.id;
                }

                if (toolCall?.function?.arguments) {
                  accumulatedArguments += toolCall.function.arguments;
                  tokensEst = Math.max(tokensEst + 1, Math.floor(accumulatedArguments.length / 4));
                  await onProgress({
                    type: 'progress',
                    tokens: tokensEst,
                    status: retryStatus ?? 'generating...'
                  });
                }
              } catch {
                // Ignore parse errors in stream chunks
              }
            }
          }
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
            const isValid = validateMnx(updatedMnxJson);
            if (!isValid) {
              validationErrors = formatValidationErrors(validateMnx.errors || []);
            } else {
              const extErrors = validateLabExtensions(updatedMnxJson);
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
