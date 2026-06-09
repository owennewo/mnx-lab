// Cloudflare Worker port of server/index.js (Express proxy).
// Serves the /api/* routes; static assets are served by Workers Assets
// in front of this Worker. The Ajv validator is precompiled at build time
// (scripts/compile-validator.mjs) because Workers disallow new Function.
import { Hono } from 'hono';
import { buildEditSystemPrompt } from '../server/prompts/editNotation.js';
import models from '../server/models.json';
import validateMnx from './generated/validate-mnx.mjs';
import { validateTabNote, validateTabPart } from './generated/validate-tab.mjs';

interface Env {
  OPENROUTER_API_KEY?: string;
}

const app = new Hono<{ Bindings: Env }>();

function hasApiKey(env: Env): env is Env & { OPENROUTER_API_KEY: string } {
  const key = env.OPENROUTER_API_KEY;
  return !!key && !key.startsWith('YOUR_');
}

function formatValidationErrors(errors: any[]): string {
  const formatted: string[] = [];
  const seen = new Set<string>();

  for (const err of errors) {
    if (err.keyword === 'anyOf' || err.keyword === 'oneOf' || err.keyword === 'allOf') {
      continue;
    }

    // Filter out alternative matching branches in sequence-content anyOf
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
 * Second validation verdict: every `_x.tab` object in the document against
 * the tab extension v2 schema (docs/tab-extension-spec.md). Standard MNX
 * validity is deliberately blind to `_x` content, so this is a separate walk.
 * Returns formatted error strings (empty array = extension-valid).
 */
function validateTabExtensions(doc: any): string[] {
  const errors: string[] = [];
  const report = (path: string, subErrors: any[] | null) => {
    for (const err of subErrors ?? []) {
      errors.push(`Tab extension: path "${path}${err.instancePath}" ${err.message}.`);
    }
  };

  (doc?.parts ?? []).forEach((part: any, pIdx: number) => {
    if (part?._x?.tab !== undefined && !validateTabPart(part._x.tab)) {
      report(`/parts/${pIdx}/_x/tab`, validateTabPart.errors);
    }
    (part?.measures ?? []).forEach((measure: any, mIdx: number) => {
      (measure?.sequences ?? []).forEach((seq: any, sIdx: number) => {
        (seq?.content ?? []).forEach((event: any, eIdx: number) => {
          (event?.notes ?? []).forEach((note: any, nIdx: number) => {
            if (note?._x?.tab !== undefined && !validateTabNote(note._x.tab)) {
              report(
                `/parts/${pIdx}/measures/${mIdx}/sequences/${sIdx}/content/${eIdx}/notes/${nIdx}/_x/tab`,
                validateTabNote.errors
              );
            }
          });
        });
      });
    });
  });

  return errors.slice(0, 5);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

app.get('/api/models', (c) => c.json(models));

// Stage 1: Voice Transcription
app.post('/api/voice-transcribe', async (c) => {
  if (!hasApiKey(c.env)) {
    console.log('No OpenRouter key found. Returning mock transcription.');
    return c.json({ success: true, text: 'transpose up 2 semitones' });
  }

  const form = await c.req.formData();
  // workers-types declare FormData.get() as string | null, but a multipart
  // file upload arrives as a File at runtime.
  const file = form.get('file') as unknown as File | string | null;
  const model = (form.get('model') as string) || 'mistralai/voxtral-mini-transcribe';

  if (!file || typeof file === 'string') {
    return c.json({ success: false, error: 'No audio file provided' }, 400);
  }

  try {
    const base64Audio = arrayBufferToBase64(await file.arrayBuffer());
    const format = file.name.split('.').pop() || 'webm';

    console.log(`Transcribing audio using model: ${model}`);
    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        input_audio: {
          data: base64Audio,
          format: format
        }
      })
    });

    const data: any = await response.json();
    if (response.ok) {
      return c.json({ success: true, text: data.text });
    }
    return c.json({ success: false, error: data.error || 'Transcription failed' }, response.status as any);
  } catch (err) {
    console.error('Transcription proxy error:', err);
    return c.json({ success: true, text: 'transpose up 2 semitones' });
  }
});

// Stage 2: Structured Music Editing via OpenRouter.
// Returns a self-correcting NDJSON stream: progress frames while the LLM
// generates, then a single done frame. On schema-validation failure the
// failed tool call plus a synthetic tool-error response are appended to the
// conversation and the LLM is re-invoked, up to maxAttempts.
app.post('/api/edit-notation', async (c) => {
  const body: any = await c.req.json();
  const { userPrompt, mnxJson, selectionContext, model = 'deepseek/deepseek-v4-flash', attachedImages = [] } = body;
  const env = c.env;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = (obj: unknown) => writer.write(encoder.encode(JSON.stringify(obj) + '\n'));

  const run = async () => {
    try {
      if (!hasApiKey(env)) {
        console.log('No OpenRouter key found. Performing local mock modification with progress streaming.');
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

      const apiKey = env.OPENROUTER_API_KEY;

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

      const tools = [
        {
          type: 'function',
          function: {
            name: 'update_document',
            description: 'Replaces the active MNX JSON document with a new, fully-modified version. Always call this tool exactly once.',
            parameters: {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  description: 'The COMPLETE, updated W3C MNX JSON document. Must be the full document, not a partial or empty object.'
                },
                notes: {
                  type: 'string',
                  description: 'A brief explanation of what was changed, or why the instruction could not be completed.'
                }
              },
              required: ['data', 'notes']
            }
          }
        }
      ];

      let attempt = 0;
      const maxAttempts = 3;
      let validationErrors: string | null = null;
      let toolCallId: string | null = null;
      let notes = '';
      let updatedMnxJson: any = null;
      let tokensEst = 0;
      // assistantContent is the model's free-text response (delta.content). Most of the
      // time it's empty because the model goes straight to the tool call, but some
      // models (or non-vision models receiving an image) emit text instead.
      let assistantContent = '';
      // OpenAI-style "required" forces a tool call but some OpenRouter providers
      // (e.g. Qwen) reject any non-default tool_choice with a 404. Start optimistic;
      // memoize the working value across retries within this request.
      let workingToolChoice = 'required';

      while (attempt < maxAttempts) {
        if (attempt > 0) {
          console.log(`Self-correction attempt ${attempt}/${maxAttempts - 1}...`);
          await send({
            type: 'progress',
            tokens: tokensEst,
            status: `retrying self-correction, attempt ${attempt}/${maxAttempts - 1}...`
          });
        } else {
          await send({ type: 'progress', tokens: 0, status: 'thinking...' });
        }

        try {
          const apiHeaders = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://mnx-lab.totai.uk',
            'X-Title': 'MNX Lab'
          };
          const buildBody = (tc: string) => JSON.stringify({
            model: model,
            messages,
            tools,
            tool_choice: tc,
            stream: true
          });

          // Try the memoized working tool_choice first. If we haven't fallen back yet
          // (still 'required'), fall back to 'auto' on a tool_choice-specific 404.
          const toolChoicesToTry = workingToolChoice === 'required' ? ['required', 'auto'] : [workingToolChoice];
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
                      await send({
                        type: 'progress',
                        tokens: tokensEst,
                        status: attempt > 0 ? `retrying self-correction, attempt ${attempt}/${maxAttempts - 1}...` : 'generating...'
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
                      await send({
                        type: 'progress',
                        tokens: tokensEst,
                        status: attempt > 0 ? `retrying self-correction, attempt ${attempt}/${maxAttempts - 1}...` : 'generating...'
                      });
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            }
          }

          if (accumulatedArguments.trim() === '') {
            await send({
              type: 'done',
              success: true,
              explanation: 'Completed instruction (no edits made).',
              updatedMnxJson: mnxJson,
              messages,
              toolCallArguments: '',
              assistantContent,
              attemptsUsed: attempt + 1
            });
            return;
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
                // Two verdicts: standard MNX schema, then the tab extension
                // schema over every _x.tab object. Both gate the retry loop.
                const isValid = validateMnx(updatedMnxJson);
                if (!isValid) {
                  validationErrors = formatValidationErrors(validateMnx.errors || []);
                } else {
                  const tabErrors = validateTabExtensions(updatedMnxJson);
                  if (tabErrors.length > 0) {
                    validationErrors = tabErrors.join('\n');
                  }
                }
              }
            }
          }

          if (!validationErrors) {
            // Validation succeeded! Send the final success payload.
            await send({
              type: 'done',
              success: true,
              explanation: notes,
              updatedMnxJson: updatedMnxJson,
              messages,
              toolCallArguments: accumulatedArguments,
              assistantContent,
              attemptsUsed: attempt + 1
            });
            return;
          }

          // Validation failed! Log and initiate retry.
          console.warn(`Validation failed on attempt ${attempt + 1}:`, validationErrors);

          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: toolCallId || `call_err_${attempt}`,
                type: 'function',
                function: {
                  name: 'update_document',
                  arguments: accumulatedArguments
                }
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
            await send({
              type: 'done',
              success: false,
              error: error.message,
              messages,
              assistantContent,
              attemptsUsed: attempt + 1
            });
            return;
          }
          attempt++;
        }
      }

      // Ran out of attempts.
      console.error('Self-correction failed after maximum attempts.');
      await send({
        type: 'done',
        success: false,
        error: `Schema validation failed after self-correction retries:\n${validationErrors}`,
        messages,
        assistantContent,
        attemptsUsed: maxAttempts
      });
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

// Offline/Mock modification logic
function handleMockCommand(prompt: string, mnx: any, context: any): string {
  const lowercasePrompt = prompt.toLowerCase();

  if (lowercasePrompt.includes('transpose')) {
    let semitones = 2;
    if (lowercasePrompt.includes('octave')) {
      semitones = 12;
    }
    const up = !lowercasePrompt.includes('down');
    const factor = up ? 1 : -1;
    const finalShift = semitones * factor;

    let notesCount = 0;

    if (mnx.parts && mnx.parts[0]) {
      const part = mnx.parts[0];
      for (const measure of part.measures) {
        if (!measure.sequences) continue;
        for (const sequence of measure.sequences) {
          for (const event of sequence.content) {
            if (event.notes) {
              for (const note of event.notes) {
                if (context.selectedNoteIds && context.selectedNoteIds.length > 0) {
                  if (!context.selectedNoteIds.includes(note.id)) continue;
                }

                if (Math.abs(finalShift) >= 12) {
                  note.pitch.octave += (finalShift / 12);
                } else {
                  if (up) {
                    if (note.pitch.alter === 0 || !note.pitch.alter) {
                      note.pitch.alter = 1;
                    } else if (note.pitch.alter === -1) {
                      note.pitch.alter = 0;
                    } else if (note.pitch.alter === 1) {
                      note.pitch.alter = 0;
                      note.pitch.octave += 1;
                    }
                  } else {
                    if (note.pitch.alter === 0 || !note.pitch.alter) {
                      note.pitch.alter = -1;
                    } else if (note.pitch.alter === 1) {
                      note.pitch.alter = 0;
                    } else if (note.pitch.alter === -1) {
                      note.pitch.alter = 0;
                      note.pitch.octave -= 1;
                    }
                  }
                }
                notesCount++;
              }
            }
          }
        }
      }
    }
    return `[Mock Mode] Transposed ${notesCount} note(s) ${up ? 'up' : 'down'} (shift amount: ${semitones} semitones).`;
  }

  if (lowercasePrompt.includes('ending') || lowercasePrompt.includes('whole note')) {
    if (mnx.parts && mnx.parts[0]) {
      const part = mnx.parts[0];
      const lastMeasure = part.measures[part.measures.length - 1];
      if (lastMeasure.sequences && lastMeasure.sequences[0]) {
        lastMeasure.sequences[0].content = [
          {
            duration: { base: 'whole' },
            notes: [{ id: 'n-end-e3', pitch: { step: 'E', octave: 3 } }]
          }
        ];
      }
    }
    return '[Mock Mode] Set final measure to a whole note E3 ending.';
  }

  if (lowercasePrompt.includes('double') || lowercasePrompt.includes('add octave')) {
    if (mnx.parts && mnx.parts[0]) {
      const part = mnx.parts[0];
      const measuresLength = part.measures.length;
      if (measuresLength === 8) {
        const extraMeasures = JSON.parse(JSON.stringify(part.measures));
        for (const m of extraMeasures) {
          if (m.sequences) {
            for (const seq of m.sequences) {
              for (const ev of seq.content) {
                if (ev.notes) {
                  for (const n of ev.notes) {
                    n.pitch.octave += 1;
                    n.id = n.id + '-oct2';
                  }
                }
              }
            }
          }
        }
        part.measures = [...part.measures, ...extraMeasures];
        mnx.global.measures = [...mnx.global.measures, ...JSON.parse(JSON.stringify(mnx.global.measures))];
      }
    }
    return '[Mock Mode] Appended a higher octave, doubling the scale length.';
  }

  return `[Mock Mode] Simulated instruction: "${prompt}" completed successfully.`;
}

export default app;
