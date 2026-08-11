# 00 — Vision

> **Stability: provisional.** Strawman written from the existing project, refined toward a
> library-first approach. Sections marked **⚠ confirm** are assumptions about *your* aims.

## One-liner

An embeddable, eventually-AI-first editor for W3C **MNX** music notation — but built
**library-first**: we start by proving we can *validate, lay out, and render* MNX correctly
across the whole spec, using a curated library of small example documents, before we add
playback, editing, or AI.

## Who it's for ⚠ confirm

- **Primary (today):** us — building confidence that the renderer handles real MNX. The
  scenario library + gallery is the tool that proves it.
- **Primary (later):** developers embedding a clean MNX viewer/editor in their own pages.
- **Secondary:** musicians/learners (esp. guitar — notation + tab).

## The one thing it must do excellently

**Turn any valid MNX document into beautiful, correct notation (and guitar tab) in the
browser.** We prove this against a *hierarchical library of minimal MNX examples that cover
the spec* — including the tricky id-referencing cases. Everything else is downstream of this
being genuinely good.

## Goals (ranked — note where AI sits)

1. **A spec-coverage scenario library.** Small, valid, readable MNX docs (mostly 1–2 bars),
   categorised hierarchically, each with metadata and a rendered reference. See
   `../inprogress/lab-04-scenario-library.md`. *This is the first deliverable.*
2. **A reusable rendering core.** Document-agnostic layout engine → primitive shapes → dumb
   SVG renderer. Proven correct against the library.
3. **A gallery app.** Browse the library, see each document's JSON, validation status, and
   rendered output. No editor, no player — and still doing a lot.
4. **Embeddability.** The renderer ships as a Shadow-DOM-isolated element, no server needed.
5. *(later)* **Playback** — Tone.js, a pure function of the document.
6. *(later)* **Editing** — only once viewing is genuinely good.
7. *(much later)* **AI chat-to-edit** — the long-term differentiator, but explicitly the
   **last** thing we build. It assumes a solid document model, renderer, and editor already
   exist.
8. *(standalone, any time)* **MusicXML ⇄ MNX conversion** — useful for sourcing library
   material; already mature in the current repo.

## Non-goals (deliberately *not* doing) ⚠ confirm

- **Not** a full DAW or a MuseScore/Sibelius replacement; we don't chase engraving
  completeness across all of CMN.
- **No AI in v1.** It is goal #7 for a reason — see above.
- **No editor or player in the first milestone.** The first thing that ships is read-only.
- **Not** a general-purpose notation *framework* — we expose packages, not a plugin system.
- **No** accounts, collaboration, or cloud sync in v1 (storage contract leaves room).
- **No** framework lock-in: no React/Vue/Redux (see `lab-01-principles.md`).
- **No** mouse-driven WYSIWYG score editing in the first editing pass — editing starts from
  the document + AI, not drag-the-notehead. *(Confirm: ever in scope, or never?)*
- v1 proves the pipeline on a focused instrument set; **guitar (notation + tab)** is the
  proving ground.

## What "done well" looks like (success criteria) ⚠ confirm

- The gallery renders the seed categories (document/pitches/durations/rhythm) and every
  scenario is `verified` (valid + rendered + visually approved).
- Every scenario in the library passes `mnx-core` validation — the library is the corpus.
- The renderer is covered by snapshot tests over the library (the current project has *zero*
  frontend tests; this fixes that from day one).
- A third-party page embeds the viewer, gets correct output, and host CSS can't break it.
- Each package installs and is usable independently of the app.

## Open questions still to resolve

1. Embedder-first or musician-first as the *eventual* product? (affects how hard we push #4)
2. Is direct-manipulation editing ever in scope, or is document/AI-driven editing permanent?
3. Library + reference app only, or is there a hosted product?
4. Beyond guitar, what instrument coverage matters in year one?
