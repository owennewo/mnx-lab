# The AI prompt in the editor — the palette's third mode

> **Status: proposed (2026-08-03), not started.** Split out of
> [editor-input-layer.md](../complete/editor-input-layer.md), whose remaining
> palette work is now go-to + commands only; the AI half grew its own design
> questions and deserves its own decision record. The research grounding is
> [research/notation-editor-keyboard-models.md](../../research/notation-editor-keyboard-models.md)
> §6.2; the voice/transcription half of this idea stays in
> [open_router.md](open_router.md).

## The idea

Dorico's Jump Bar has two sub-modes — commands and go-to. MNX Lab's natural third
is **prompt**: the same `Ctrl+K` input box routing to `/api/edit-notation` when
the text is a sentence rather than a command. A keyboard-first front door for the
assist path that already exists (the NDJSON self-correcting loop in
`worker/editLoop.ts`), needing no new surface beyond the palette itself.

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

## Not this

- Not the voice/transcription stage — that is [open_router.md](open_router.md)'s
  remaining half, layered on top of this once text prompts work.
- Not a chat: one prompt, one edit, landed in history. The Assist drawer
  remains the conversational surface.
