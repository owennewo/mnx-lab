import { css } from 'lit';

/**
 * THE SCORE'S OWN TOKENS — the paper, its ink, its rules, and the accent.
 *
 * Split out of `designTokens` (2026-08-14) because the viewer must be
 * SELF-SUFFICIENT. `designTokens` is declared on the *app component's* host and
 * inherits down through the workbench's shadow roots; an embedded
 * `<mnx-score-viewer>` has no such ancestor, so every one of these was
 * UNDEFINED on a host page — `background: var(--paper)` fell back to
 * transparent, ink inherited the host's text colour, and
 * `stroke: var(--paper-line)` computed to `none`, i.e. **the staff lines were
 * not drawn at all**. The public `--mnx-*` overrides were dead there too,
 * since the vars that read them live in this block. See
 * roadmap/proposed/core-viewer-embedded-app.md.
 *
 * THEME: the paper now follows the colour scheme, reversing the older "the
 * score always renders on warm paper, even under dark chrome" rule — a dark
 * page with a blazing white score is the thing the embed app made obvious.
 * Resolution is automatic and needs no API: `light-dark()` resolves against
 * the *used* `color-scheme`, which is an inherited property, so the component
 * honours whatever the host page declared (and, for a page that says
 * `light dark`, the reader's OS preference). `<mnx-score-viewer theme="…">`
 * overrides explicitly — see ScoreViewer.
 */
export const scoreTokens = css`
  :host {
    /* ACCENT vs the engine's frozen error red — read this before retuning.
       The Modernist accent (#ec3013) and the diagnostic red that
       layout/diagnostics.ts hard-codes for validation errors (#b91c1c) are
       only ~4 degrees apart in hue: oklch(0.611 0.225 31.5) against
       oklch(0.505 0.190 27.5). The diagnostic hex is emitted as a fill
       attribute into the SVG and is baked into 10 committed goldens, so it
       CANNOT move — the accent is the only side with any room.
       They stay tellable apart on two axes, and both must hold:
         VALUE — the accent is ~0.11 lighter and more saturated. Keep that gap.
         FORM  — a diagnostic is a filled circle carrying a white glyph; the
                 selection is a stroked enclosure and a tinted notehead.
       Checked on a real stave at the hands-on review, never in a swatch.
       See roadmap/proposed/core-modernist-tokens.md. */
    --accent: var(--mnx-accent, light-dark(oklch(0.611 0.225 31.5), oklch(0.7 0.19 31.5)));
    --paper: var(--mnx-paper, light-dark(oklch(1 0 0), oklch(0.235 0.008 80)));
    --paper-ink: var(--mnx-paper-ink, light-dark(oklch(0.237 0.004 60), oklch(0.92 0.008 85)));
    --paper-line: var(
      --mnx-paper-line,
      light-dark(oklch(0.52 0.006 60), oklch(0.68 0.012 85))
    );
  }
`;

/**
 * THE CORNER SCALE — one knob per role, so the whole app's radius is a token
 * decision rather than 39 literals (roadmap/proposed/core-modernist-tokens.md,
 * stage 1). Values here are the ones the app already used; this block was
 * introduced as a deliberate no-op so the flip that follows is a one-file diff.
 *
 * Composed into BOTH `viewerTokens` and `designTokens` rather than duplicated
 * into each the way the colour vars are: `sharedChrome` and `scrollbars` cite
 * these and are included by the standalone viewer as well as the app, so a
 * value that drifted between the two would restyle the embed only.
 *
 * NOT in this scale, on purpose: `border-radius: 50%` on `.pip` / `.vchip .vdot`
 * and the 1px softening on `.gapdia`. Those are **shapes that carry meaning** —
 * the rail's dots vary shape as well as colour so *stale* cannot be mistaken for
 * *never seen* (CLAUDE.md), and the gap diamond is a rotated square. A circular
 * status mark is not a rounded corner, and the design system agrees: its own
 * stylesheet keeps `border-radius: 50%` on radio dots while every radius token
 * is 0.
 */
export const radiusTokens = css`
  :host {
    /* All zero, per the design's one hard "don't": *do not round a corner
       anywhere*. The roles are kept as separate names rather than collapsed to
       a single --radius, because they record WHAT is being squared and let a
       consumer re-round one family without re-deriving the sweep. */
    --radius-pill: 0px;
    --radius-card: 0px;
    --radius-panel: 0px;
    --radius-control: 0px;
    --radius-input: 0px;
    --radius-tab: 0px;
    --radius-chip: 0px;
    --radius-xs: 0px;
    --radius-hair: 0px;
  }
`;

/**
 * The tokens `<mnx-score-viewer>` needs to stand ALONE on a stranger's page:
 * the score tokens plus the handful of chrome vars its own stylesheet (and
 * `sharedChrome`/`scrollbars`) reference. Declared on the viewer's own host, so
 * an embed is fully styled with zero host setup, and `--mnx-*` overrides work
 * there for the first time.
 *
 * The light values are IDENTICAL to `designTokens`' — inside the workbench
 * these definitions win (a closer host beats an inherited value), so any drift
 * would silently restyle the app. Only the dark half is new, and the workbench
 * never resolves to it: it declares no `color-scheme`, so `light-dark()` stays
 * light there until someone deliberately opts the app in.
 */
export const viewerTokens = css`
  ${scoreTokens}
  ${radiusTokens}
  :host {
    /* TWO VOICES, STRICTLY: Archivo for anything a person wrote or reads as
       prose, mono for anything the machine owns — paths, hashes, ids, op names,
       coordinates, JSON. Never mono for a whole sentence, never Archivo for an
       id. There is no --serif: the design system is set entirely in Archivo,
       and the headings that used one now share this stack.

       Archivo is bundled by the WORKBENCH face (src/entries/main.ts, via
       @fontsource — no CDN). The embed face ships no document CSS and so
       cannot load it; the fallback chain is what carries that case, and an
       embedder who does load Archivo gets it. Both token blocks must name the
       same stack regardless — their light values are identical BY CONTRACT
       (see viewerTokens), because the viewer declares its own host inside the
       app and a closer host wins.

       --mono is a system stack on purpose, not an omission. */
    --sans: 'Archivo', 'Helvetica Neue', Helvetica, system-ui, sans-serif;
    --mono: ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', Menlo, monospace;

    --bg: var(--mnx-bg, light-dark(oklch(0.962 0.002 60), oklch(0.185 0.004 60)));
    --surface: var(--mnx-surface, light-dark(oklch(1 0 0), oklch(0.237 0.004 60)));
    --bg-context: light-dark(oklch(0.983 0.002 60), oklch(0.212 0.004 60));
    --line: var(--mnx-line, light-dark(oklch(0.887 0.005 60), oklch(0.38 0.005 60)));
    --line-strong: light-dark(oklch(0.807 0.007 60), oklch(0.5 0.006 60));
    --rule-w: 2px;
    --ink: var(--mnx-ink, light-dark(oklch(0.237 0.004 60), oklch(0.94 0.003 60)));
    --ink-2: light-dark(oklch(0.397 0.006 60), oklch(0.78 0.005 60));
    --ink-3: light-dark(oklch(0.62 0.008 60), oklch(0.62 0.006 60));
    --accent-fg: light-dark(var(--accent), color-mix(in oklab, var(--accent), white 22%));
    /* One step past the base, which is the design system's own instruction for
       a pressed/held state. Also the "this tile is already on" ink. */
    --accent-pressed: light-dark(oklch(0.508 0.186 31.5), oklch(0.62 0.17 31.5));
    /* Between --ink-3 and --line-strong: text that must recede further than
       muted without becoming a rule. */
    --ink-faint: light-dark(oklch(0.754 0.008 60), oklch(0.5 0.008 60));
    --row-current: color-mix(in oklab, var(--accent), var(--bg) 90%);
    --row-done: var(--line);
    /* Rides --accent-fg, not --accent: on a dark ground the ring must use
       the lightened accent or it sinks into the page. */
    --focus-ring: var(--mnx-focus-ring, color-mix(in oklab, var(--accent-fg), transparent 25%));
    --hover: light-dark(oklch(0 0 0 / 0.035), oklch(1 0 0 / 0.05));
    /* light-dark() takes COLORS, not whole shadow lists — so the scheme-
       dependent part is factored into a colour the shadow then uses. */
    --shadow-near: light-dark(oklch(0.237 0.004 60 / 0.14), oklch(1 0 0 / 0.06));
    --shadow-far: light-dark(oklch(0.237 0.004 60 / 0.16), oklch(0 0 0 / 0.45));
    --shadow: 0 1px 2px var(--shadow-near), 0 3px 10px var(--shadow-far);
  }
`;

/**
 * MNX Lab design tokens (see claude_design/…/mnx-lab-redesign/tokens.css and
 * DIRECTION.md — "the reading room"). Declared on the app component's :host so
 * they inherit through every child shadow root; embedders can override via the
 * public --mnx-* custom properties (P4: no styles on `document`).
 *
 * Composes `scoreTokens` so the app chrome and the score agree on paper and
 * accent without either duplicating the values.
 */
export const designTokens = css`
  ${scoreTokens}
  ${radiusTokens}
  :host {
    /* TWO VOICES, STRICTLY: Archivo for anything a person wrote or reads as
       prose, mono for anything the machine owns — paths, hashes, ids, op names,
       coordinates, JSON. Never mono for a whole sentence, never Archivo for an
       id. There is no --serif: the design system is set entirely in Archivo,
       and the headings that used one now share this stack.

       Archivo is bundled by the WORKBENCH face (src/entries/main.ts, via
       @fontsource — no CDN). The embed face ships no document CSS and so
       cannot load it; the fallback chain is what carries that case, and an
       embedder who does load Archivo gets it. Both token blocks must name the
       same stack regardless — their light values are identical BY CONTRACT
       (see viewerTokens), because the viewer declares its own host inside the
       app and a closer host wins.

       --mono is a system stack on purpose, not an omission. */
    --sans: 'Archivo', 'Helvetica Neue', Helvetica, system-ui, sans-serif;
    --mono: ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', Menlo, monospace;

    --rail-w: 312px;
    --header-h: 52px;
    --footer-h: 30px;

    /* THE QUEUE'S MARKS (roadmap/proposed/workbench-queue-pips.md).
       Four states through a one-accent system. Colour cannot carry four
       meanings here, so it carries ONE - saturated red is spent on blocked,
       the only state that means stop - and the rest separate on LIGHTNESS and
       on SHAPE, which the rail already used so stale could not read as
       never-seen.

       The steps are spread far enough to survive GRAYSCALE, which this item's
       doc names as its acceptance test and which
       harness/conformance/design-tokens.test.ts now asserts: colour is the
       redundant channel here, never the only one.

       They carry their own values rather than aliasing the ink ramp, as an
       earlier draft did: those steps are spaced for TEXT contrast, and reusing
       them put unseen within 0.08 of the accent in dark - invisible in a
       swatch, identical in grayscale. Spaced here for four 7px marks. */
    --st-blocked: var(--accent);
    --st-stale: light-dark(oklch(0.25 0.005 60), oklch(0.92 0.004 60));
    --st-unseen: light-dark(oklch(0.45 0.006 60), oklch(0.56 0.006 60));
    --st-current: light-dark(oklch(0.83 0.004 60), oklch(0.34 0.005 60));

    --bg: var(--mnx-bg, light-dark(oklch(0.962 0.002 60), oklch(0.185 0.004 60)));
    --bg-rail: var(--mnx-bg-rail, light-dark(oklch(0.945 0.002 60), oklch(0.16 0.004 60)));
    --surface: var(--mnx-surface, light-dark(oklch(1 0 0), oklch(0.237 0.004 60)));
    /* Band 3 of the panel frame, and the shared hover fill. */
    --bg-context: light-dark(oklch(0.983 0.002 60), oklch(0.212 0.004 60));
    /* Dark: LIGHTER than the surface it separates. A darker line on a dark
       ground reads as a seam, not as structure, and structure is what this
       system organises with. */
    --line: var(--mnx-line, light-dark(oklch(0.887 0.005 60), oklch(0.38 0.005 60)));
    --line-strong: light-dark(oklch(0.807 0.007 60), oklch(0.5 0.006 60));
    /* One knob for the design's structural rule: alignment and the strength of
       the dividers do the organising, so this must never soften to a hairline.
       Unchanged across themes — a rule is 2px on any ground. */
    --rule-w: 2px;
    --ink: var(--mnx-ink, light-dark(oklch(0.237 0.004 60), oklch(0.94 0.003 60)));
    --ink-2: light-dark(oklch(0.397 0.006 60), oklch(0.78 0.005 60));
    --ink-3: light-dark(oklch(0.62 0.008 60), oklch(0.62 0.006 60));
    --accent-fg: light-dark(var(--accent), color-mix(in oklab, var(--accent), white 22%));
    /* One step past the base, which is the design system's own instruction for
       a pressed/held state ("accent-600 on a light ground, accent-400 on a
       dark one"). Also the "this tile is already on" ink. */
    --accent-pressed: light-dark(oklch(0.508 0.186 31.5), oklch(0.62 0.17 31.5));
    /* Between --ink-3 and --line-strong: text that must recede further than
       muted without becoming a rule. */
    --ink-faint: light-dark(oklch(0.754 0.008 60), oklch(0.5 0.008 60));
    /* The shared row states (ops head, active rung, current row). Derived from
       the accent rather than pinned to #fce7e3 so a future accent carries its
       own tint instead of leaving a stale pink behind — and so both themes get
       one for free. */
    --row-current: color-mix(in oklab, var(--accent), var(--bg) 90%);
    --row-done: var(--line);
    /* The keyboard-ownership ring (roadmap/proposed/core-editor-focus-scope.md):
       drawn while focus is inside the viewer, so "who gets the next keystroke"
       is legible without pressing a key. Public — a host page restyles it.
       Rides --accent-fg so the dark half gets the lightened accent, or the ring
       vanishes into the ground. */
    --focus-ring: var(--mnx-focus-ring, color-mix(in oklab, var(--accent-fg), transparent 25%));
    --hover: light-dark(oklch(0 0 0 / 0.035), oklch(1 0 0 / 0.05));
    /* Ink-tinted and shallow: in this system nothing floats, so elevation is a
       hint that something sits above the page, not a soft cushion under it. On
       a dark ground the design system's own note applies — "a hairline edge +
       ambient darkness" — so the near layer becomes an edge.
       light-dark() takes COLOURS, not whole shadow lists, so the scheme-
       dependent parts are factored out the way viewerTokens already does. */
    --shadow-near: light-dark(oklch(0.237 0.004 60 / 0.14), oklch(1 0 0 / 0.06));
    --shadow-far: light-dark(oklch(0.237 0.004 60 / 0.16), oklch(0 0 0 / 0.45));
    --shadow: 0 1px 2px var(--shadow-near), 0 3px 10px var(--shadow-far);
    --drawer-shadow: -12px 0 32px -12px light-dark(oklch(0.237 0.004 60 / 0.22), oklch(0 0 0 / 0.6));
    --json-string: light-dark(oklch(0.52 0.1 155), oklch(0.75 0.1 155));
    --json-number: light-dark(oklch(0.55 0.13 60), oklch(0.75 0.12 60));
    --json-boolean: light-dark(oklch(0.5 0.13 300), oklch(0.74 0.11 300));

    font-family: var(--sans);
    font-size: 13.5px;
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }

`;

/**
 * Chrome primitives shared by several components: status pips, the spec-gap
 * diamond, buttons, chips, segmented controls. Include alongside a component's
 * own styles; the variables come from designTokens on the app host.
 */
export const sharedChrome = css`
  * {
    box-sizing: border-box;
  }

  button {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  input,
  textarea {
    font-family: inherit;
    color: var(--ink);
  }

  a {
    color: var(--accent-fg);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  ::selection {
    background: color-mix(in oklab, var(--accent), transparent 70%);
  }

  /* THE SHARED ROW STATES. One definition for the ops queue's head, the HUD's
     active rung, the tray's active tile and (later) the compare tab's
     difference rows — the design specifies these as one vocabulary across every
     list in the app, and before this they were three independent spellings of
     the same two states (ScenarioPage's li.current/li.future, ScoreHud's
     .row.active). A list opts in by adding the class; the left edge is drawn on
     every row so that becoming current does not shift the text sideways. */
  .row-state {
    border-left: var(--rule-w) solid transparent;
  }

  .row-state.row-current {
    border-left-color: var(--accent);
    background: var(--row-current);
    color: var(--ink);
  }

  /* Past the head: the redo branch, still readable but plainly not in play. */
  .row-state.row-past {
    opacity: 0.45;
  }

  /* Settled — matches, resolved, nothing to do. Grey edge, quiet text. */
  .row-state.row-done {
    border-left-color: var(--row-done);
    color: var(--ink-3);
  }

  .row-state:hover:not(.row-current) {
    background: var(--bg-context);
  }

  /* .pip[data-st] and .gapdia lived here and were rendered by NOTHING - dead
     since some earlier refactor, and between them they were the only consumers
     of two of the five status tokens. Removed with those tokens
     (roadmap/proposed/workbench-queue-pips.md). The live status marks are the
     rail's and the coverage map's own .dot rules. */

  .tb-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    white-space: nowrap;
    border: 1px solid var(--line);
    border-radius: var(--radius-tab);
    color: var(--ink-2);
    font-size: 12px;
    background: var(--surface);
  }

  .tb-btn:hover:not(:disabled) {
    background: var(--hover);
    color: var(--ink);
  }

  .tb-btn.on {
    border-color: var(--accent-fg);
    color: var(--accent-fg);
  }

  .tb-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .seg {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: var(--radius-input);
    background: var(--surface);
    padding: 2px;
    gap: 1px;
  }

  .seg button {
    padding: 4px 13px;
    border-radius: var(--radius-chip);
    font-size: 12.5px;
    color: var(--ink-2);
  }

  .seg button:hover:not(:disabled) {
    color: var(--ink);
  }

  .seg button.on {
    background: var(--accent);
    color: oklch(0.99 0 0);
  }

  .seg button:disabled {
    color: var(--ink-3);
    opacity: 0.45;
    cursor: not-allowed;
  }

  .fchip {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: var(--radius-pill);
    white-space: nowrap;
    border: 1px solid var(--line);
    color: var(--ink-2);
    background: transparent;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .fchip b {
    font-weight: 500;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-3);
  }

  .fchip:hover {
    background: var(--hover);
  }

  .fchip.on {
    border-color: var(--accent-fg);
    color: var(--accent-fg);
  }

  .fchip.on b {
    color: var(--accent-fg);
  }

  /* .vchip lived here - a verdict chip in three status colours, rendered by
     nothing. It went with the status ramp it cited. .fchip and .tb-btn are
     also unrendered today but cite only live tokens, so they are left alone
     rather than swept up in a colour change. */
`;

/** Scrollbar treatment shared by every scrollable pane. */
export const scrollbars = css`
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--line-strong);
    border-radius: var(--radius-tab);
    border: 3px solid transparent;
    background-clip: content-box;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }
`;

