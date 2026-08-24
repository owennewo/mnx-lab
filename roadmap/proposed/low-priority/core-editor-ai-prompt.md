# The AI prompt in the editor — the third input mode

> **Status: proposed (2026-08-03), not started. Revised 2026-08-20**: absorbed
> the voice/transcription stage from the retired
> [core-open-router.md](../../superseded/core-open-router.md) (a pre-rebuild doc;
> its text-edit half shipped long ago as the Worker's NDJSON loop, in a
> different shape than it drew), and re-homed the mode after the palette's
> rebinding — the original "`Ctrl+K` third sub-mode" framing predates the tray.
> Split out of
> [core-editor-input-layer.md](../../complete/core-editor-input-layer.md), whose remaining
> palette work is now go-to + commands only; the AI half grew its own design
> questions and deserves its own decision record. The research grounding is
> [research/notation-editor-keyboard-models.md](../../../research/notation-editor-keyboard-models.md)
> §6.2.

## The idea

Dorico's Jump Bar has two sub-modes — commands and go-to. MNX Lab's natural third
is **prompt**: typed text routing to `/api/edit-notation` when it reads as a
sentence rather than a command. A keyboard-first front door for the assist path
that already exists (the self-correcting loop, now `src/assist/editLoop.ts` —
live endpoint, client reader in `src/assist/stream.ts`, today with zero
callers), needing no new surface beyond the ones that exist.

**Where it lives is no longer "the `Ctrl+K` box".** Since this was proposed,
Chrome reclaimed `Ctrl+K` and the command surface split in two
([core-selection-tray-global-tab.md](../../complete/core-selection-tray-global-tab.md)):
`/` opens the selection tray (commands, escalating outward) and `Ctrl+G` is
go-to (destinations). The prompt is a third kind of utterance — neither a
command nor a destination — so its home is a design decision this item owns:
a prompt row in the tray's `global` tab, a mode of the go-to box, or its own
binding. The disambiguation question below survives the move unchanged.

## Constraints already settled elsewhere

- **The boundary**: this is the only palette mode that touches the Worker, so it
  inherits the `ui/ → assist/` rule unchanged — the palette calls `assist/`,
  never the API directly.
- **Published schema only**: the Worker and retry loop never learn
  proposed-schema fields (CLAUDE.md); the prompt mode changes nothing there.
- **No key, no problem**: with no `OPENROUTER_API_KEY` the shared mock
  (`src/assist/mock.ts`) keeps the palette's prompt mode demoable.

## The deeper half: the loop emits EditOp[]

`src/edit/ops.ts` has named this convergence since the placeholder was written:
today the assist loop replaces **whole documents**; the plan is for it to emit
`EditOp[]` through the same `applyOp` funnel as the keyboard, so undo/redo,
validation, the op log and provenance all live in one place. The prompt mode is
the natural forcing function — an edit arriving through the palette should land
in the session's history like any other edit, not as a document swap that
clears it. Pieces:

- a tool schema for the op vocabulary (the union in `ops.ts`, which setup ops
  and entry ops have now made expressive enough to be worth exposing);
- the Worker validating emitted ops the way it validates documents today
  (precompiled validators; the same two-verdict discipline);
- fallback: when the model can't express an edit as ops, whole-document
  replacement remains — diffed into the session as one composite op, so undo
  still works.

## Design questions this item owns

- **Sentence vs command disambiguation** in one input box — prefix (`>` for
  commands, bare text for prompt?), heuristic, or explicit mode toggle. Flat and
  Dorico both prefix; a wrong guess here sends a command to an LLM.
- **Traces and determinism.** Trace fixtures replay deterministically; an
  `{type: 'aiPrompt', text}` intent would not. The likely answer: the trace
  records the **ops the loop emitted**, not the prompt (the prompt is
  provenance, kept alongside the way raw key logs are) — but that shape should
  be decided before the first AI edit is recorded.
- **Streaming into the session**: the NDJSON frames show attempts and
  validation failures live; what the edit strip shows while a prompt is in
  flight, and whether a failed loop leaves any trace in history.
- **Where the palette lives** when this lands — if the palette has been
  promoted to `elements/` by then, the prompt mode's `assist/` dependency
  moves the `elements → assist` boundary question to the front (embeds
  probably should NOT ship an AI prompt; the mode may be workbench-only by
  configuration).

## The voice stage (absorbed from core-open-router, 2026-08-20)

Layered on top once text prompts work — never built first, because every
question it raises lands on the text path anyway. What survives from the
original two-stage design:

- **Two-stage submission, always.** Speech is transcribed to text and placed
  into the prompt input for review; the user fixes musical terms the
  transcriber mangles ("F sharp" ≠ "effective") and submits deliberately.
  Voice never fires an edit directly — the review step is the safety.
- **Capture is browser-native** (MediaRecorder, hold-to-talk, clips under
  ~10s), and **transcription goes through the Worker** like every other
  OpenRouter call — the key stays server-side, so this is one new Worker
  route (a transcription model, e.g. Voxtral-class) beside `editNotation`,
  inheriting the same no-key mock discipline.
- **Everything downstream is this doc's text path** — the transcript enters
  the same prompt surface, the same loop, the same trace story. The retired
  doc's own stage 2 (Express proxy, whole-document swap, VexFlow rerender) is
  superseded by what actually shipped and must not be consulted as a design.

## Not this

- Not a chat: one prompt, one edit, landed in history. The Assist drawer
  remains the conversational surface.
