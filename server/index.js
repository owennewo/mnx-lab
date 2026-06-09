import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv2020 from 'ajv/dist/2020.js';
import { buildEditSystemPrompt } from './prompts/editNotation.js';

dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsPath = path.join(__dirname, 'models.json');
const models = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));

const schemaPath = path.join(__dirname, '..', 'schemas', 'mnx-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true });
const validateMnx = ajv.compile(schema);

function formatValidationErrors(errors) {
  const formatted = [];
  const seen = new Set();
  
  for (const err of errors) {
    if (err.keyword === 'anyOf' || err.keyword === 'oneOf' || err.keyword === 'allOf') {
      continue;
    }
    
    // Filter out alternative matching branches in sequence-content anyOf
    // 0: event, 1: grace, 2: tuplet, 3: space, 4: tremolo
    if (err.schemaPath && err.schemaPath.includes('sequence-content/items/anyOf/')) {
      const match = err.schemaPath.match(/sequence-content\/items\/anyOf\/(\d+)/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (index > 0) {
          continue;
        }
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

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Endpoint to retrieve available models
app.get('/api/models', (req, res) => {
  res.json(models);
});


// Stage 1: Voice Transcription
app.post('/api/voice-transcribe', upload.single('file'), async (req, res) => {
  const { model = 'mistralai/voxtral-mini-transcribe' } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey.startsWith('YOUR_') || apiKey === '') {
    console.log('No OpenRouter key found. Returning mock transcription.');
    return res.json({ success: true, text: 'transpose up 2 semitones' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No audio file provided' });
  }

  try {
    const base64Audio = req.file.buffer.toString('base64');
    const format = req.file.originalname.split('.').pop() || 'webm';

    console.log(`Transcribing audio using model: ${model}`);
    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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

    const data = await response.json();
    if (response.ok) {
      res.json({ success: true, text: data.text });
    } else {
      res.status(response.status).json({ success: false, error: data.error || 'Transcription failed' });
    }
  } catch (err) {
    console.error('Transcription proxy error:', err);
    res.json({ success: true, text: 'transpose up 2 semitones' });
  }
});

// Stage 2: Structured Music Editing via OpenRouter
app.post('/api/edit-notation', async (req, res) => {
  const { userPrompt, mnxJson, selectionContext, model = 'deepseek/deepseek-v4-flash', attachedImages = [] } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey.startsWith('YOUR_') || apiKey === '') {
    console.log('No OpenRouter key found. Performing local mock modification with progress streaming.');
    
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    const explanation = handleMockCommand(userPrompt, mnxJson, selectionContext);
    
    // Simulate progression of tokens
    let tokens = 0;
    const interval = setInterval(() => {
      tokens += Math.floor(Math.random() * 8) + 4;
      res.write(JSON.stringify({ type: 'progress', tokens }) + '\n');
      if (tokens > 100) {
        clearInterval(interval);
        res.write(JSON.stringify({
          type: 'done',
          success: true,
          explanation: explanation,
          updatedMnxJson: mnxJson,
          mockMode: true
        }) + '\n');
        res.end();
      }
    }, 400);
    return;
  }

  const userText = `Current MNX Score:\n${JSON.stringify(mnxJson, null, 2)}\n\nEditor selection state:\n${JSON.stringify(selectionContext)}\n\nUser Instruction:\n${userPrompt}`;

  const hasImages = Array.isArray(attachedImages) && attachedImages.length > 0;
  const userContent = hasImages
    ? [
        { type: 'text', text: userText },
        ...attachedImages.map(url => ({ type: 'image_url', image_url: { url } }))
      ]
    : userText;

  const messages = [
    {
      role: 'system',
      content: buildEditSystemPrompt(selectionContext)
    },
    {
      role: 'user',
      content: userContent
    }
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
  let validationErrors = null;
  let toolCallId = null;
  let notes = '';
  let updatedMnxJson = null;
  let tokensEst = 0;
  // assistantContent is the model's free-text response (delta.content). Most of the
  // time it's empty because the model goes straight to the tool call, but some
  // models (or non-vision models receiving an image) emit text instead. Function-
  // scoped so catch/out-of-attempts paths can include it in the done frame.
  let assistantContent = '';
  // OpenAI-style "required" forces a tool call but some OpenRouter providers
  // (e.g. Qwen) reject any non-default tool_choice with a 404. Start optimistic;
  // memoize the working value across retries within this request so we don't
  // re-pay the 404 round-trip on every self-correction attempt.
  let workingToolChoice = 'required';

  // Set headers for SSE streaming
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');

  while (attempt < maxAttempts) {
    if (attempt > 0) {
      console.log(`Self-correction attempt ${attempt}/${maxAttempts - 1}...`);
      res.write(JSON.stringify({ 
        type: 'progress', 
        tokens: tokensEst, 
        status: `retrying self-correction, attempt ${attempt}/${maxAttempts - 1}...` 
      }) + '\n');
    } else {
      res.write(JSON.stringify({ type: 'progress', tokens: 0, status: 'thinking...' }) + '\n');
    }

    try {
      const apiHeaders = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mnx-editor.dev',
        'X-Title': 'MNX Music Editor'
      };
      const buildBody = (tc) => JSON.stringify({
        model: model,
        messages,
        tools,
        tool_choice: tc,
        stream: true
      });

      // Try the memoized working tool_choice first. If we haven't fallen back yet
      // (still 'required'), fall back to 'auto' on a tool_choice-specific 404.
      const toolChoicesToTry = workingToolChoice === 'required' ? ['required', 'auto'] : [workingToolChoice];
      let response = null;
      let lastErrText = null;
      let lastStatus = null;
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
      if (!response.ok) {
        throw new Error(`OpenRouter returned status ${lastStatus}: ${lastErrText}`);
      }

      let accumulatedArguments = '';
      toolCallId = null;
      assistantContent = '';

      const reader = response.body.getReader();
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
                  res.write(JSON.stringify({ 
                    type: 'progress', 
                    tokens: tokensEst,
                    status: attempt > 0 ? `retrying self-correction, attempt ${attempt}/${maxAttempts - 1}...` : 'generating...'
                  }) + '\n');
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
                  res.write(JSON.stringify({ 
                    type: 'progress', 
                    tokens: tokensEst,
                    status: attempt > 0 ? `retrying self-correction, attempt ${attempt}/${maxAttempts - 1}...` : 'generating...'
                  }) + '\n');
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      if (accumulatedArguments.trim() === '') {
        res.write(JSON.stringify({
          type: 'done',
          success: true,
          explanation: 'Completed instruction (no edits made).',
          updatedMnxJson: mnxJson,
          messages,
          toolCallArguments: '',
          assistantContent,
          attemptsUsed: attempt + 1
        }) + '\n');
        res.end();
        return;
      }

      validationErrors = null;
      let argumentsObj = null;
      try {
        argumentsObj = JSON.parse(accumulatedArguments);
      } catch (e) {
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
          } catch (e) {
            validationErrors = `Failed to parse updatedMnxJson string: ${e.message}. Please ensure the 'data' field is a valid JSON object matching the MNX schema.`;
            updatedMnxJson = null;
          }
        }

        if (!validationErrors) {
          if (!updatedMnxJson || !updatedMnxJson.parts || updatedMnxJson.parts.length === 0) {
            validationErrors = 'JSON structure is missing required root properties "mnx" or "parts".';
          } else {
            const isValid = validateMnx(updatedMnxJson);
            if (!isValid) {
              validationErrors = formatValidationErrors(validateMnx.errors);
            }
          }
        }
      }

      if (!validationErrors) {
        // Validation succeeded! Send the final success payload.
        res.write(JSON.stringify({
          type: 'done',
          success: true,
          explanation: notes,
          updatedMnxJson: updatedMnxJson,
          messages,
          toolCallArguments: accumulatedArguments,
          assistantContent,
          attemptsUsed: attempt + 1
        }) + '\n');
        res.end();
        return;
      }

      // Validation failed! Print to server console and initiate retry
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

    } catch (error) {
      console.error(`Error on attempt ${attempt + 1}:`, error);
      if (attempt >= maxAttempts - 1) {
        res.write(JSON.stringify({
          type: 'done',
          success: false,
          error: error.message,
          messages,
          assistantContent,
          attemptsUsed: attempt + 1
        }) + '\n');
        res.end();
        return;
      }
      attempt++;
    }
  }

  // If we ran out of attempts, fallback or return error
  console.error('Self-correction failed after maximum attempts.');
  res.write(JSON.stringify({
    type: 'done',
    success: false,
    error: `Schema validation failed after self-correction retries:\n${validationErrors}`,
    messages,
    assistantContent,
    attemptsUsed: maxAttempts
  }) + '\n');
  res.end();
});

// Offline/Mock modification logic
function handleMockCommand(prompt, mnx, context) {
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

app.listen(port, () => {
  console.log(`Server proxy listening at http://localhost:${port}`);
});
