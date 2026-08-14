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
    --accent: var(--mnx-accent, light-dark(#3e5c86, #8aa9d6));
    --paper: var(--mnx-paper, light-dark(oklch(0.985 0.006 85), oklch(0.235 0.008 80)));
    --paper-ink: var(--mnx-paper-ink, light-dark(oklch(0.24 0.015 80), oklch(0.92 0.008 85)));
    --paper-line: var(
      --mnx-paper-line,
      light-dark(oklch(0.55 0.012 80), oklch(0.68 0.012 85))
    );
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
  :host {
    --sans: 'IBM Plex Sans', 'Helvetica Neue', Helvetica, sans-serif;
    --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;
    --serif: 'IBM Plex Serif', Georgia, serif;

    --bg: var(--mnx-bg, light-dark(oklch(0.967 0.005 88), oklch(0.185 0.008 75)));
    --surface: var(--mnx-surface, light-dark(oklch(0.992 0.003 88), oklch(0.255 0.01 75)));
    --line: var(--mnx-line, light-dark(oklch(0.895 0.007 88), oklch(0.31 0.01 75)));
    --line-strong: light-dark(oklch(0.82 0.008 88), oklch(0.38 0.01 75));
    --ink: var(--mnx-ink, light-dark(oklch(0.255 0.012 80), oklch(0.9 0.008 85)));
    --ink-2: light-dark(oklch(0.45 0.012 80), oklch(0.72 0.01 85));
    --ink-3: light-dark(oklch(0.6 0.01 80), oklch(0.58 0.01 85));
    --accent-fg: light-dark(var(--accent), color-mix(in oklab, var(--accent), white 38%));
    --focus-ring: var(--mnx-focus-ring, color-mix(in oklab, var(--accent), transparent 25%));
    --hover: light-dark(oklch(0 0 0 / 0.045), oklch(1 0 0 / 0.05));
    /* light-dark() takes COLORS, not whole shadow lists — so the scheme-
       dependent part is factored into a colour the shadow then uses. */
    --shadow-near: light-dark(oklch(0 0 0 / 0.05), oklch(0 0 0 / 0.3));
    --shadow-far: light-dark(oklch(0.3 0.02 80 / 0.18), oklch(0 0 0 / 0.5));
    --shadow: 0 1px 2px var(--shadow-near), 0 6px 24px -8px var(--shadow-far);
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
  :host {
    --sans: 'IBM Plex Sans', 'Helvetica Neue', Helvetica, sans-serif;
    --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;
    --serif: 'IBM Plex Serif', Georgia, serif;

    --rail-w: 312px;
    --header-h: 52px;
    --footer-h: 30px;

    --st-draft: oklch(0.62 0.012 80);
    --st-valid: oklch(0.66 0.105 78);
    --st-rendered: oklch(0.55 0.1 155);
    --st-verified: oklch(0.5 0.1 250);
    --st-gap: oklch(0.55 0.125 42);

    --bg: var(--mnx-bg, oklch(0.967 0.005 88));
    --bg-rail: var(--mnx-bg-rail, oklch(0.952 0.006 88));
    --surface: var(--mnx-surface, oklch(0.992 0.003 88));
    --line: var(--mnx-line, oklch(0.895 0.007 88));
    --line-strong: oklch(0.82 0.008 88);
    --ink: var(--mnx-ink, oklch(0.255 0.012 80));
    --ink-2: oklch(0.45 0.012 80);
    --ink-3: oklch(0.6 0.01 80);
    --accent-fg: var(--accent);
    /* The keyboard-ownership ring (roadmap/proposed/core-editor-focus-scope.md):
       drawn while focus is inside the viewer, so "who gets the next keystroke"
       is legible without pressing a key. Public — a host page restyles it. */
    --focus-ring: var(--mnx-focus-ring, color-mix(in oklab, var(--accent), transparent 25%));
    --hover: oklch(0 0 0 / 0.045);
    --shadow: 0 1px 2px oklch(0 0 0 / 0.05), 0 6px 24px -8px oklch(0.3 0.02 80 / 0.18);
    --drawer-shadow: -12px 0 32px -12px oklch(0 0 0 / 0.18);
    --json-string: oklch(0.52 0.1 155);
    --json-number: oklch(0.55 0.13 60);
    --json-boolean: oklch(0.5 0.13 300);

    font-family: var(--sans);
    font-size: 13.5px;
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }

  :host([resolved-theme='dark']) {
    --bg: var(--mnx-bg, oklch(0.215 0.009 75));
    --bg-rail: var(--mnx-bg-rail, oklch(0.195 0.009 75));
    --surface: var(--mnx-surface, oklch(0.255 0.01 75));
    --line: var(--mnx-line, oklch(0.31 0.01 75));
    --line-strong: oklch(0.38 0.01 75);
    --ink: var(--mnx-ink, oklch(0.9 0.008 85));
    --ink-2: oklch(0.72 0.01 85);
    --ink-3: oklch(0.58 0.01 85);
    --accent-fg: color-mix(in oklab, var(--accent), white 38%);
    /* Dark: ride the lightened accent, or the ring vanishes into the ground. */
    --focus-ring: var(--mnx-focus-ring, color-mix(in oklab, var(--accent-fg), transparent 20%));
    --hover: oklch(1 0 0 / 0.05);
    --shadow: 0 1px 2px oklch(0 0 0 / 0.3), 0 10px 32px -8px oklch(0 0 0 / 0.5);
    --drawer-shadow: -12px 0 32px -12px oklch(0 0 0 / 0.6);
    --st-draft: oklch(0.66 0.012 80);
    --st-valid: oklch(0.74 0.105 78);
    --st-rendered: oklch(0.68 0.1 155);
    --st-verified: oklch(0.68 0.1 250);
    --st-gap: oklch(0.68 0.125 42);
    --json-string: oklch(0.75 0.1 155);
    --json-number: oklch(0.75 0.12 60);
    --json-boolean: oklch(0.74 0.11 300);
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

  .pip {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .pip[data-st='draft'] {
    background: transparent;
    border: 1.2px solid var(--st-draft);
  }

  .pip[data-st='valid'] {
    background: var(--st-valid);
  }

  .pip[data-st='rendered'] {
    background: var(--st-rendered);
  }

  .pip[data-st='verified'] {
    background: var(--st-verified);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--st-verified), transparent 75%);
  }

  .gapdia {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    background: var(--st-gap);
    transform: rotate(45deg);
    border-radius: 1px;
  }

  .tb-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    white-space: nowrap;
    border: 1px solid var(--line);
    border-radius: 6px;
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
    border-radius: 7px;
    background: var(--surface);
    padding: 2px;
    gap: 1px;
  }

  .seg button {
    padding: 4px 13px;
    border-radius: 5px;
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
    border-radius: 999px;
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

  .vchip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
    font-family: var(--mono);
    font-size: 10.5px;
    padding: 2.5px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--ink-2);
  }

  .vchip .vdot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .vchip.ok {
    color: var(--st-rendered);
    border-color: color-mix(in oklab, var(--st-rendered), transparent 55%);
  }

  .vchip.gap {
    color: var(--st-gap);
    border-color: color-mix(in oklab, var(--st-gap), transparent 50%);
  }

  .vchip.sketch {
    color: var(--st-valid);
    border-color: color-mix(in oklab, var(--st-valid), transparent 45%);
  }

  .vchip.clicky {
    cursor: pointer;
    background: transparent;
  }

  .vchip.clicky:hover,
  .vchip.clicky.on {
    border-color: var(--accent-fg);
    color: var(--accent-fg);
  }
`;

/** Scrollbar treatment shared by every scrollable pane. */
export const scrollbars = css`
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--line-strong);
    border-radius: 6px;
    border: 3px solid transparent;
    background-clip: content-box;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }
`;

