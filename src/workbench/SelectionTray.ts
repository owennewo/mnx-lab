// The selection command tray (roadmap/inprogress/core-selection-tray-visuals.md):
// a command surface planted under the selection — scope tabs that are the
// ladder's rungs, a Bravura glyph grid with shortcut and state per tile, the
// shaft+plinth connector, hover readout and scoped search.
//
// The component is deliberately dumb — tabs, tiles, rows and the anchor arrive
// as neutral view-model data, and every interaction leaves as a composed
// CustomEvent. That is the promotion posture (the ScoreHud precedent):
// `elements/` never imports `edit/`, so a tray that one day moves there must
// already speak a neutral contract. Incubating in `workbench/`, where churn is
// free. The one non-model import is the engine's SMuFL name→codepoint lookup,
// which `elements/` is also allowed.
//
// Styling is FAITHFUL to the design spec ("SPEC · v1 — selection command
// tray") — and since 2026-08-15 it says so in TOKENS rather than in literals.
// The tray shipped ahead of its system, hard-coding the design's palette
// because the workbench had not adopted it yet; the Modernist campaign moved
// the chrome to meet the tray, so the ~55 literals became `var(--ink)`,
// `var(--accent)` and friends with no visual change. The visuals doc's
// "deliberately apart from the surrounding chrome" ruling is retired.
//
// It still does NOT include `designTokens`, and that is now load-bearing for a
// different reason than before: the tokens reach here by INHERITANCE from
// `<mnx-workbench>`'s host (custom properties cross shadow boundaries), and
// the dark half is selected by a `resolved-theme` attribute on that host.
// Re-declaring designTokens here would plant a light-only `:host` block
// between the app and this component and pin the tray light forever — the
// theme switch would visibly skip it. A workbench leaf should inherit its
// palette, not restate it.
// See roadmap/proposed/core-campaign-modernist.md.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { glyphBBox, glyphCodepoint, isSmuflLoaded } from '../engine/smufl/smufl.ts';

/** One scope tab. `active` = the tab on display; `holdsSelection` marks the
 *  tab still owning the real selection while another is only previewed. */
export interface TrayTab {
  key: string;
  label: string;
  active: boolean;
  holdsSelection: boolean;
}

/** A Bravura glyph by canonical SMuFL name, or one of the two marks that have
 *  no single glyph and are drawn as two-point SVG arcs (slur/tie). */
export type TrayGlyph = { smufl: string } | { arc: 'slur' | 'tie' };

export type TrayTileState = 'available' | 'active' | 'mixed' | 'unavailable';

export interface TrayTile {
  id: string;
  glyph: TrayGlyph;
  shortcut: string;
  label: string;
  state: TrayTileState;
}

/** The part tab's variant: commands that carry values render as labelled rows
 *  with the current value flush right — a bare glyph cannot show a value. */
export interface TrayRow {
  id: string;
  glyph: TrayGlyph;
  label: string;
  value: string;
}

/**
 * How large a tile glyph is drawn, in px along its longest side.
 *
 * A palette normalizes optical size; a score does not. Drawn at one true scale,
 * a staccato dot is a 3px speck beside a 34px repeat barline — musically
 * honest and useless to pick from. So each glyph is scaled to read at the same
 * size, with a ceiling so the smallest marks are enlarged rather than blown up
 * (Dorico's and Sibelius's palettes do the same).
 */
const GLYPH_TARGET_PX = 34;
const GLYPH_MAX_PX_PER_SP = 30;
/** The readout's copy of the same idea — a row, so it wants a smaller mark. */
const READOUT_GLYPH_PX = 19;

export interface TrayMeta {
  primary: string;
  secondary?: string;
  count?: string;
}

/** The selection's box in the coordinate space of the tray's offsetParent. */
export interface TrayAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SHAFT_H = 30;
const PLINTH_H = 6;
const EDGE_GAP = 8;
// The design mocks 470/330, but its tab row held four scopes — ours holds the
// whole ladder (seven), so the rows variant gets more room and the tab
// padding below is a shade tighter than the spec's 13px.
const TRAY_W = 470;
const TRAY_W_ROWS = 400;

@customElement('mnx-selection-tray')
export class SelectionTray extends LitElement {
  @property({ attribute: false }) tabs: TrayTab[] = [];
  @property({ attribute: false }) meta: TrayMeta | null = null;
  @property({ attribute: false }) tiles: TrayTile[] = [];
  @property({ attribute: false }) rows: TrayRow[] = [];
  @property({ attribute: false }) anchor: TrayAnchor | null = null;
  @property({ type: String }) searchText = '';

  /** The keyboard tile cursor — an index into the focusable tiles/rows. */
  @state() private cursorIndex = 0;
  /** The pointer's tile, when hovering; wins over the cursor in the readout. */
  @state() private hoverId: string | null = null;
  /** Set when the connector flips above the selection (no room below). */
  @state() private flipped = false;

  static styles = css`
    :host {
      position: absolute;
      z-index: 30;
      display: block;
      width: var(--tray-w, 470px);
      font-family: var(--sans);
      outline: none;
      /* Re-anchoring animates position, never fades (the spec's rule). */
      transition:
        left 0.16s ease,
        top 0.16s ease;
    }

    /* ── connector ── */
    .shaft {
      position: absolute;
      height: ${SHAFT_H}px;
      background: var(--accent);
    }

    :host(:not([data-flipped])) .shaft {
      bottom: 100%;
    }

    :host([data-flipped]) .shaft {
      top: 100%;
    }

    .plinth {
      height: ${PLINTH_H}px;
      background: var(--ink);
    }

    .tray {
      background: var(--surface);
      border: 2px solid var(--ink);
      box-shadow: 0 18px 40px color-mix(in oklab, var(--ink), transparent 82%);
    }

    :host(:not([data-flipped])) .tray {
      border-top: 0;
    }

    :host([data-flipped]) .tray {
      border-bottom: 0;
    }

    /* ── B · scope tabs ── */
    .tabs {
      display: flex;
      align-items: stretch;
      border-bottom: 1px solid var(--line);
    }

    .tabs button {
      font: 600 10px/1 var(--sans);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--ink-3);
      background: none;
      border: 0;
      padding: 11px 9px;
      cursor: pointer;
      white-space: nowrap;
    }

    .tabs button:hover {
      color: var(--ink);
      background: var(--bg-context);
    }

    .tabs button[aria-current='true'] {
      color: var(--accent);
      box-shadow: inset 0 -2px 0 var(--accent);
    }

    .tabs .dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      background: var(--accent);
      margin-left: 6px;
      vertical-align: middle;
    }

    .tabs .hint {
      margin-left: auto;
      display: flex;
      align-items: center;
      padding: 0 9px;
      font: 500 10px/1 var(--sans);
      letter-spacing: 0.06em;
      color: var(--ink-faint);
      flex: none;
    }

    /* ── C · meta line ── */
    .meta {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 13px;
      border-bottom: 2px solid var(--ink);
      background: var(--bg-context);
      white-space: nowrap;
      overflow: hidden;
    }

    .meta .primary {
      font: 600 11.5px/1 var(--sans);
      color: var(--ink);
    }

    .meta .secondary {
      font: 400 11.5px/1 var(--sans);
      color: var(--ink-3);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta .count {
      margin-left: auto;
      font: 500 10px/1 var(--sans);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-3);
    }

    .meta .count.widen {
      color: var(--accent);
    }

    /* ── D · glyph grid ── */
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      padding: 13px;
    }

    .tile {
      position: relative;
      width: 66px;
      height: 64px;
      background: var(--surface);
      border: 1px solid var(--line);
      cursor: pointer;
      font: inherit;
      padding: 0;
    }

    /*
     * The glyph is centred on its INK, not on its text box. SMuFL glyphs are
     * drawn against a staff — a repeat barline carries side bearings for the
     * staff lines around it, a dot is a speck at the baseline — so centring the
     * text box leaves several of them visibly off, and font ascent/descent is
     * no better a guide.
     *
     * So each tile glyph is drawn into an SVG whose viewBox IS the glyph's
     * bounding box, as the font's own metadata reports it. The box is then the
     * ink and nothing else, and ordinary centring does the rest. Bravura
     * measures in staff spaces and 1em = 4 of them, which is the font-size in
     * the markup; the px size comes from GLYPH_TARGET_PX.
     */
    .tile {
      display: grid;
      place-items: center;
      /* The chip owns the bottom-right corner, so the glyph is centred in the
       * space ABOVE it rather than in the whole tile — otherwise a wide mark
       * (the accent) runs into its own shortcut. */
      padding-bottom: 9px;
    }

    .tile .glyph {
      color: var(--ink);
      /* The ink box is the viewBox, and the text inside it carries the font's
         full em box — ascent and descent well beyond the glyph's own ink.
         Visible overflow is what lets that ink paint past the tiny box, but
         overflow is HIT-TESTABLE as well as paintable: without the rule
         below, each glyph captures the pointer over its neighbours and a
         tile two rows down answers for a hover on this one. The button is
         the only thing that should ever be hovered. */
      overflow: visible;
      pointer-events: none;
    }

    /* The shortcut sits in the corner rather than under the glyph: it is a
     * label ON the tile, not a second row competing with it for the eye. */
    .tile .key {
      position: absolute;
      right: 0;
      bottom: 0;
      pointer-events: none;
      min-width: 17px;
      padding: 2px 4px;
      background: var(--ink);
      color: var(--surface);
      font: 600 9.5px/1.2 var(--sans);
      letter-spacing: 0.04em;
      text-align: center;
    }

    .tile svg path {
      stroke: var(--ink);
    }

    .tile:hover,
    .tile.cursor {
      background: var(--row-current);
      border-color: var(--accent);
    }

    .tile[data-state='active'] {
      background: var(--accent);
      border-color: var(--accent);
    }

    .tile[data-state='active']:hover,
    .tile[data-state='active'].cursor {
      background: var(--accent-pressed);
      border-color: var(--accent-pressed);
    }

    .tile[data-state='active'] .glyph {
      color: var(--surface);
    }

    /* On the accent fill the dark chip would disappear, so it inverts. */
    .tile[data-state='active'] .key {
      background: var(--surface);
      color: var(--ink);
    }

    .tile[data-state='active'] svg path {
      stroke: var(--surface);
    }

    .tile[data-state='mixed'] {
      box-shadow: inset 2px 0 0 var(--accent);
    }

    .tile[data-state='unavailable'] {
      background: var(--bg-context);
      border-color: var(--line);
      cursor: default;
      pointer-events: none;
    }

    .tile[data-state='unavailable'] .glyph {
      color: var(--line-strong);
    }

    .tile[data-state='unavailable'] .key {
      background: var(--line);
      color: var(--ink-faint);
    }

    /* ── D′ · value rows (the part tab) ── */
    .vrows .vrow {
      display: flex;
      align-items: center;
      gap: 11px;
      width: 100%;
      padding: 8px 13px;
      border: 0;
      border-bottom: 1px solid var(--line);
      background: none;
      cursor: pointer;
      font: inherit;
      text-align: left;
      box-sizing: border-box;
    }

    .vrows .vrow:last-child {
      border-bottom: 0;
    }

    .vrows .vrow:hover,
    .vrows .vrow.cursor {
      background: var(--row-current);
    }

    .vrow .glyph {
      font-family: Bravura;
      font-size: 22px;
      line-height: 1;
      width: 24px;
      color: var(--ink);
    }

    .vrow .label {
      font: 500 12.5px/1 var(--sans);
      color: var(--ink);
    }

    .vrow .value {
      margin-left: auto;
      font: 500 11px/1 var(--sans);
      color: var(--ink-3);
    }

    /* ── E · hover readout ── */
    .readout {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 13px;
      background: var(--ink);
    }

    .readout .glyph {
      /* Drawn into its own bounding box, like the tiles, so a repeat barline
       * sits on the row's centre line instead of hanging off a text baseline.
       * The row is a flex box, so centring is then automatic. */
      flex: none;
      overflow: visible;
      font-family: Bravura;
      font-size: 19px;
      line-height: 1;
      color: var(--surface);
    }

    .readout svg path {
      stroke: var(--surface);
    }

    .readout .words {
      font: 500 11.5px/1 var(--sans);
      color: var(--surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .readout .chip {
      margin-left: auto;
      font: 600 10px/1 var(--sans);
      letter-spacing: 0.1em;
      color: var(--surface);
      border: 1px solid color-mix(in oklab, var(--ink), var(--surface) 25%);
      padding: 4px 6px;
      flex: none;
    }

    /* ── F · search ── */
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 13px;
      border-top: 2px solid var(--ink);
      background: var(--bg-context);
    }

    .search .prompt {
      font: 600 12px/1 var(--sans);
      color: var(--accent);
    }

    .search input {
      flex: 1;
      font: 400 12px/1 var(--sans);
      color: var(--ink);
      background: none;
      border: 0;
      outline: none;
      padding: 0;
    }

    .search input::placeholder {
      color: var(--ink-3);
    }
  `;

  constructor() {
    super();
    this.addEventListener('keydown', this.onKeyDown);
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1');
  }

  firstUpdated() {
    this.focus();
  }

  // ── placement ─────────────────────────────────────────────────────────────

  /** Focusable entries in display order — tiles or rows, whichever variant is
   *  on screen. Unavailable tiles are skipped (the spec: not focusable). */
  private entries(): { id: string; label: string; shortcut: string; glyph: TrayGlyph }[] {
    if (this.rows.length > 0) {
      return this.rows.map(r => ({ id: r.id, label: r.label, shortcut: r.value, glyph: r.glyph }));
    }
    return this.tiles
      .filter(t => t.state !== 'unavailable')
      .map(t => ({ id: t.id, label: t.label, shortcut: t.shortcut, glyph: t.glyph }));
  }

  updated(changed: Map<string | number | symbol, unknown>) {
    if (changed.has('tabs') || changed.has('tiles') || changed.has('rows')) {
      this.cursorIndex = Math.min(this.cursorIndex, Math.max(0, this.entries().length - 1));
    }
    this.place();
  }

  /** Position the tray from the anchor: below the selection, left edge at the
   *  selection's left edge, clamped inside the offsetParent; flip above when
   *  there is no room below. Anchor-less (nothing selected / geometry
   *  unknown): docked bottom-center — the fallback the visuals doc names. */
  private place() {
    const host = this;
    const parent = this.offsetParent as HTMLElement | null;
    if (!parent) return;
    const width = this.rows.length > 0 ? TRAY_W_ROWS : TRAY_W;
    host.style.setProperty('--tray-w', `${width}px`);
    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const trayH = this.getBoundingClientRect().height || 200;

    const anchor = this.anchor;
    const shaftEl = this.renderRoot.querySelector<HTMLElement>('.shaft');
    if (!anchor) {
      this.flipped = false;
      this.removeAttribute('data-flipped');
      if (shaftEl) shaftEl.style.display = 'none';
      host.style.left = `${Math.max(EDGE_GAP, (pw - width) / 2)}px`;
      host.style.top = `${Math.max(EDGE_GAP, ph - trayH - 18)}px`;
      return;
    }

    const left = Math.min(Math.max(anchor.x, EDGE_GAP), Math.max(EDGE_GAP, pw - width - EDGE_GAP));
    const below = anchor.y + anchor.height + SHAFT_H;
    const flip = below + trayH > ph && anchor.y - SHAFT_H - trayH > 0;
    this.flipped = flip;
    this.toggleAttribute('data-flipped', flip);
    host.style.left = `${left}px`;
    host.style.top = `${flip ? anchor.y - SHAFT_H - trayH : below}px`;

    // The shaft: selection width clamped 24–240, centred on the selection's
    // horizontal centre, clamped to the tray's span.
    const shaft = shaftEl;
    if (shaft) {
      const w = Math.min(240, Math.max(24, anchor.width));
      const centre = anchor.x + anchor.width / 2 - left;
      const x = Math.min(Math.max(centre - w / 2, 0), Math.max(0, width - w));
      shaft.style.left = `${x}px`;
      shaft.style.width = `${w}px`;
      shaft.style.display = 'block';
    }
  }

  // ── keyboard (a scope-4 region: the tray owns the keys it names) ─────────

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.composedPath()[0] as HTMLElement;
    const inSearch = target instanceof HTMLInputElement;
    if (inSearch && event.code !== 'Escape') return; // typing stays typing

    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    const previewing = this.tabs.some(t => t.holdsSelection && !t.active);

    switch (event.code) {
      case 'Escape': {
        consume();
        if (inSearch) {
          this.focus();
          return;
        }
        if (previewing) {
          // Escape returns to the tab still holding the selection.
          const home = this.tabs.find(t => t.holdsSelection);
          if (home) this.emit('tray-tab-preview', { key: home.key });
          return;
        }
        this.emit('tray-close', {});
        return;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        consume();
        const idx = this.tabs.findIndex(t => t.active);
        const next = this.tabs[idx + (event.code === 'ArrowUp' ? 1 : -1)];
        if (next) this.emit('tray-tab-preview', { key: next.key });
        return;
      }
      case 'ArrowRight':
      case 'ArrowLeft':
      case 'Tab': {
        consume();
        const n = this.entries().length;
        if (n === 0) return;
        const back = event.code === 'ArrowLeft' || (event.code === 'Tab' && event.shiftKey);
        this.cursorIndex = (this.cursorIndex + (back ? n - 1 : 1)) % n;
        return;
      }
      case 'Enter':
      case 'NumpadEnter': {
        consume();
        if (previewing) {
          const active = this.tabs.find(t => t.active);
          if (active) this.emit('tray-tab-commit', { key: active.key });
          return;
        }
        const entry = this.entries()[this.cursorIndex];
        if (entry) this.emit('tray-command', { id: entry.id });
        return;
      }
    }

    // Any printable character jumps focus to the search line (the spec's
    // rule). The triggering character is appended by hand because refocusing
    // mid-keydown does not retarget the insertion.
    if (!inSearch && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      consume();
      const input = this.renderRoot.querySelector<HTMLInputElement>('.search input');
      if (input) {
        input.focus();
        input.value += event.key;
        this.emit('tray-search', { text: input.value });
      }
    }
  };

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  // ── rendering ─────────────────────────────────────────────────────────────

  private glyph(glyph: TrayGlyph, cls = 'glyph', targetPx?: number) {
    if ('arc' in glyph) {
      // Slur and tie have no single SMuFL glyph — two-point arcs, per spec.
      const d = glyph.arc === 'slur' ? 'M2 11C7 2 19 2 24 11' : 'M3 4C8 11 18 11 23 4';
      const scale = targetPx ? targetPx / 26 : 1;
      return html`<svg
        class=${cls}
        width=${26 * scale}
        height=${14 * scale}
        viewBox="0 0 26 14"
      >
        <path d=${d} fill="none" stroke-width="2"></path>
      </svg>`;
    }
    let char = '?';
    if (isSmuflLoaded()) {
      try {
        char = glyphCodepoint(glyph.smufl);
      } catch {
        char = '?';
      }
    }
    // A tile glyph is drawn into its own bounding box (see the .glyph rule), so
    // the element IS the ink and centring is exact. Without metadata loaded
    // there is no box to draw into, so it falls back to plain text.
    const box = targetPx ? glyphBBox(glyph.smufl) : null;
    if (!box) return html`<span class=${cls}>${char}</span>`;
    const scale = Math.min(targetPx! / Math.max(box.w, box.h), GLYPH_MAX_PX_PER_SP);
    return html`<svg
      class=${cls}
      width=${(box.w * scale).toFixed(2)}
      height=${(box.h * scale).toFixed(2)}
      viewBox="${box.x.toFixed(4)} ${(-(box.y + box.h)).toFixed(4)} ${box.w.toFixed(
        4
      )} ${box.h.toFixed(4)}"
    >
      <text x="0" y="0" font-family="Bravura" font-size="4" fill="currentColor">${char}</text>
    </svg>`;
  }

  private readout() {
    const entries = this.entries();
    const focused =
      (this.hoverId !== null ? entries.find(e => e.id === this.hoverId) : undefined) ??
      entries[this.cursorIndex];
    if (!focused) return nothing;
    return html`<div class="readout">
      ${this.glyph(focused.glyph, 'glyph', READOUT_GLYPH_PX)}
      <span class="words">${focused.label}</span>
      <span class="chip">${focused.shortcut || '·'}</span>
    </div>`;
  }

  render() {
    const previewing = this.tabs.some(t => t.holdsSelection && !t.active);
    const entries = this.entries();
    return html`
      <div class="shaft" style="display: none"></div>
      ${this.flipped ? nothing : html`<div class="plinth"></div>`}
      <div class="tray">
        <div class="tabs">
          ${this.tabs.map(
            tab => html`
              <button
                aria-current=${tab.active ? 'true' : 'false'}
                @click=${() => this.emit('tray-tab-preview', { key: tab.key })}
              >
                ${tab.label}${tab.holdsSelection && !tab.active
                  ? html`<span class="dot"></span>`
                  : nothing}
              </button>
            `
          )}
          <span class="hint">↑↓</span>
        </div>
        ${this.meta
          ? html`<div class="meta">
              <span class="primary">${this.meta.primary}</span>
              ${this.meta.secondary
                ? html`<span class="secondary">${this.meta.secondary}</span>`
                : nothing}
              ${previewing
                ? html`<span class="count widen">↵ to widen selection</span>`
                : this.meta.count
                  ? html`<span class="count">${this.meta.count}</span>`
                  : nothing}
            </div>`
          : nothing}
        ${this.rows.length > 0
          ? html`<div class="vrows" @mouseleave=${() => (this.hoverId = null)}>
              ${this.rows.map(
                (row, i) => html`
                  <button
                    class="vrow ${entries[this.cursorIndex]?.id === row.id ? 'cursor' : ''}"
                    @click=${() => this.emit('tray-command', { id: row.id })}
                    @mouseenter=${() => (this.hoverId = row.id)}
                    @focus=${() => (this.cursorIndex = i)}
                  >
                    ${this.glyph(row.glyph)}
                    <span class="label">${row.label}</span>
                    <span class="value">${row.value}</span>
                  </button>
                `
              )}
            </div>`
          : html`<div class="grid" @mouseleave=${() => (this.hoverId = null)}>
              ${this.tiles.map(
                tile => html`
                  <button
                    class="tile ${'arc' in tile.glyph ? 'arc-tile' : ''} ${entries[
                      this.cursorIndex
                    ]?.id === tile.id
                      ? 'cursor'
                      : ''}"
                    data-state=${tile.state}
                    tabindex=${tile.state === 'unavailable' ? '-1' : '0'}
                    title=${tile.label}
                    @click=${() => this.emit('tray-command', { id: tile.id })}
                    @mouseenter=${() => (this.hoverId = tile.id)}
                  >
                    ${this.glyph(tile.glyph, 'glyph', GLYPH_TARGET_PX)}
                    <span class="key">${tile.shortcut}</span>
                  </button>
                `
              )}
            </div>`}
        ${this.readout()}
        <div class="search">
          <span class="prompt">&gt;</span>
          <input
            .value=${this.searchText}
            placeholder="search this scope, or Ctrl+Shift+K for global…"
            @input=${(e: Event) =>
              this.emit('tray-search', { text: (e.target as HTMLInputElement).value })}
          />
        </div>
      </div>
      ${this.flipped ? html`<div class="plinth"></div>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-selection-tray': SelectionTray;
  }
}
