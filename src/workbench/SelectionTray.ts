// The selection command tray (roadmap/complete/workbench-selection-chip-ladder.md,
// after core-selection-tray-visuals.md): a command surface planted under the
// selection — a VERTICAL ladder column whose current rung is the collapsed
// chip grown in place, a Bravura glyph grid with shortcut and state per tile,
// the accent shaft, and scoped search.
//
// The component is deliberately dumb — rungs, tiles and the anchor arrive
// as neutral view-model data, and every interaction leaves as a composed
// CustomEvent. That is the promotion posture (the ScoreHud precedent):
// `elements/` never imports `edit/`, so a tray that one day moves there must
// already speak a neutral contract. Incubating in `workbench/`, where churn is
// free. The one non-model import is the engine's SMuFL name→codepoint lookup,
// which `elements/` is also allowed.
//
// Styling is FAITHFUL to the design spec — "SPEC · v1 — SELECTION MODE CHIP →
// TRAY" replaces the older tray spec's horizontal tab strip. Its thesis is
// that the closed chip and the open tray are ONE object: the chip *is* the
// current rung, so opening must not re-case the word, move its x, or change
// its box. That is why the scope selector is now a 74px column of lowercase
// mono rungs at the tray's leading edge rather than an uppercase tab row
// across its top. Since 2026-08-15 the palette is spoken in TOKENS rather
// than literals; a conformance test holds that line.
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

/** One rung of the ladder. `active` = the rung on display; `holdsSelection`
 *  marks the rung still owning the real selection while another is only
 *  previewed. */
export interface TrayRung {
  key: string;
  label: string;
  active: boolean;
  holdsSelection: boolean;
  /** Can the selection be moved here? False for a row that is not a rung —
   *  the `global` scope sits outside the ladder, so there is nothing for
   *  Enter to commit and the widen hint would be a lie. Absent = true. */
  committable?: boolean;
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

/**
 * The connector, now 8px rather than the old 30: the spec plants the tray one
 * small gap below the selection's lower bound and lets the shaft fill exactly
 * that gap, so the ladder reads as growing out of the selection instead of
 * dangling from it on a thread.
 */
export const TRAY_SHAFT_H = 8;
/** The gap the chip and the tray both sit at, below the selection. */
export const TRAY_EDGE_GAP = 8;
/** The ladder column: lowercase mono rungs, the current one lit. */
const LADDER_W = 74;
/**
 * Total tray width. The spec draws a 222px tile panel beside the ladder, which
 * was enough for the six tiles it mocked; our busiest scope (`event`) carries
 * eighteen, and at three columns the tray outgrows the score pane it floats
 * over. So the panel keeps the 470px total the previous tray established —
 * five columns of the spec's own 60px tiles — and every other metric is the
 * spec's.
 */
export const TRAY_WIDTH = 470;
/** The spec's mirror trigger: flip when the tray's right edge would pass the
 *  score's right edge minus this. */
export const TRAY_MIRROR_MARGIN = 16;

@customElement('mnx-selection-tray')
export class SelectionTray extends LitElement {
  @property({ attribute: false }) rungs: TrayRung[] = [];
  @property({ attribute: false }) meta: TrayMeta | null = null;
  @property({ attribute: false }) tiles: TrayTile[] = [];
  @property({ attribute: false }) anchor: TrayAnchor | null = null;
  @property({ type: String }) searchText = '';
  /**
   * Which edge the tray hangs from. Decided by the PAGE, not here, and held
   * for the life of the open tray — the chip and the tray must agree about the
   * side (they are one object), and the spec forbids flipping mid-interaction.
   * The page snapshots it when `/` opens the tray.
   */
  @property({ type: Boolean }) mirrored = false;

  /** The keyboard tile cursor — an index into the focusable tiles. */
  @state() private cursorIndex = 0;
  /**
   * Has the cursor been MOVED, as opposed to merely defaulting to the first
   * tile on open? Only then does the cursor caption itself.
   *
   * Without this the tooltip is pinned open over the meta line for as long as
   * the tray is open — the cursor starts somewhere, so something is always
   * "focused" — which is not what a tooltip is. The ring already marks where
   * Enter would land; the name is what you ask for by navigating.
   */
  @state() private cursorMoved = false;

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
      height: ${TRAY_SHAFT_H}px;
      background: var(--accent);
    }

    :host(:not([data-flipped])) .shaft {
      bottom: 100%;
    }

    /* Flipped above the selection, the shaft is a capital on the tray's top
     * edge rather than a footing under it — the spec's rule; the ladder still
     * reads top-to-bottom either way. */
    :host([data-flipped]) .shaft {
      top: 100%;
    }

    .tray {
      display: flex;
      align-items: stretch;
      box-sizing: border-box;
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--ink);
      box-shadow: 0 14px 34px color-mix(in oklab, var(--ink), transparent 78%);
    }

    /* Mirrored: the ladder crosses to the far side so the current rung still
     * lands under the selection's right edge, and the tiles grow leftwards
     * into the room that exists. Everything mirrors TOGETHER. */
    :host([data-mirrored]) .tray {
      flex-direction: row-reverse;
    }

    /* ── B · the ladder column ── */
    .ladder {
      width: ${LADDER_W}px;
      flex: none;
      background: var(--bg-context);
      border-right: 1px solid var(--line);
    }

    :host([data-mirrored]) .ladder {
      border-right: 0;
      border-left: 1px solid var(--line);
    }

    /* A rung is the chip's own box: the same lowercase mono word, never
     * re-cased. The uppercase tab strip this replaced broke the one thing the
     * chip and the tray have to share. */
    .rung {
      display: block;
      box-sizing: border-box;
      width: 100%;
      text-align: left;
      padding: 4px 8px;
      border: 0;
      border-left: 2px solid transparent;
      background: none;
      font: 500 10.5px/1.35 var(--mono);
      color: var(--ink-3);
      cursor: pointer;
      white-space: nowrap;
    }

    :host([data-mirrored]) .rung {
      text-align: right;
      border-left: 0;
      border-right: 2px solid transparent;
    }

    .rung:hover {
      color: var(--ink);
      background: var(--surface);
    }

    .rung[aria-current='true'] {
      color: var(--accent-fg);
      background: var(--row-current);
      border-left-color: var(--accent);
    }

    :host([data-mirrored]) .rung[aria-current='true'] {
      border-left-color: transparent;
      border-right-color: var(--accent);
    }

    .rung .dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      background: var(--accent);
      margin-left: 5px;
      vertical-align: middle;
    }

    /* ── the tile panel ── */
    .panel {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    /* ── C · meta line ── */
    .meta {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 6px 9px;
      border-bottom: 1px solid var(--line);
      background: var(--bg-context);
      white-space: nowrap;
      overflow: hidden;
    }

    .meta .primary {
      font: 500 10px/1.2 var(--mono);
      color: var(--ink);
    }

    .meta .secondary {
      font: 400 10px/1.2 var(--mono);
      color: var(--ink-3);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta .count {
      margin-left: auto;
      font: 600 8.5px/1.2 var(--sans);
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--ink-3);
      flex: none;
    }

    .meta .count.widen {
      color: var(--accent-fg);
    }

    /* ── D · glyph grid ── */
    .grid {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 6px;
      padding: 9px;
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
      position: relative;
      width: 60px;
      height: 60px;
      display: grid;
      place-items: center;
      /* The key badge owns the bottom-right corner, so the glyph is centred in
       * the space ABOVE it rather than in the whole tile — otherwise a wide
       * mark (the accent) runs into its own shortcut. */
      padding: 0 0 9px;
      background: var(--surface);
      border: 1px solid var(--line);
      cursor: pointer;
      font: inherit;
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
     * label ON the tile, not a second row competing with it for the eye. It
     * overhangs the border by a pixel, so the badge reads as stamped onto the
     * tile's corner rather than inset from it. */
    .tile .key {
      position: absolute;
      right: -1px;
      bottom: -1px;
      pointer-events: none;
      box-sizing: border-box;
      min-width: 22px;
      height: 22px;
      padding: 0 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--ink);
      color: var(--surface);
      font: 600 11px/1 var(--sans);
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

    /* On the accent fill the dark badge would disappear, so it inverts. */
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
    }

    .tile[data-state='unavailable'] .glyph {
      color: var(--line-strong);
    }

    .tile[data-state='unavailable'] .key {
      background: var(--line);
      color: var(--ink-faint);
    }

    /*
     * E · the tile's name, as a tooltip rather than a standing readout band.
     *
     * The old tray reserved a whole row under the grid to print the focused
     * tile's label and shortcut. The shortcut is already stamped on every
     * tile, so that band was spending a band on the label alone — and the
     * spec's tray has no room for it. A tooltip says the same thing at the
     * point of interest and costs nothing when nobody is asking.
     *
     * It answers the KEYBOARD cursor as well as the pointer, which a native
     * title attribute cannot: arrowing the grid must name what is under the
     * cursor, or the keyboard path loses information the pointer path keeps.
     * When both are live the pointer wins, so the grid never captions two
     * tiles at once — and the cursor only captions itself once it has been
     * MOVED (see cursorMoved), or the tooltip would stand open over the meta
     * line for the whole life of the tray.
     */
    .tile .tip {
      position: absolute;
      left: 50%;
      bottom: calc(100% + 5px);
      transform: translateX(-50%);
      z-index: 4;
      display: none;
      box-sizing: border-box;
      max-width: 190px;
      width: max-content;
      padding: 3px 6px;
      background: var(--ink);
      color: var(--surface);
      font: 500 10px/1.4 var(--sans);
      text-align: center;
      pointer-events: none;
    }

    .tile:hover .tip,
    .tile.cursor-named .tip {
      display: block;
    }

    .grid:hover .tile.cursor-named:not(:hover) .tip {
      display: none;
    }

    /* ── F · search ── */
    .search {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 6px 9px;
      border-top: 1px solid var(--line);
      background: var(--bg-context);
    }

    .search .prompt {
      font: 600 11px/1.2 var(--mono);
      color: var(--accent-fg);
    }

    .search input {
      flex: 1;
      min-width: 0;
      font: 400 11px/1.4 var(--mono);
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

  /** Focusable entries in display order. Unavailable tiles are skipped (the
   *  spec: not focusable). */
  private entries(): { id: string; label: string; shortcut: string; glyph: TrayGlyph }[] {
    return this.tiles
      .filter(t => t.state !== 'unavailable')
      .map(t => ({ id: t.id, label: t.label, shortcut: t.shortcut, glyph: t.glyph }));
  }

  updated(changed: Map<string | number | symbol, unknown>) {
    if (changed.has('rungs') || changed.has('tiles')) {
      this.cursorIndex = Math.min(this.cursorIndex, Math.max(0, this.entries().length - 1));
    }
    this.place();
  }

  /**
   * Position the tray from the anchor. Normally its LEFT edge sits on the
   * selection's left edge, so the ladder column — and therefore the word —
   * occupies exactly the x the closed chip occupied. Mirrored (decided by the
   * page, held for the open), its RIGHT edge sits on the selection's right
   * edge and the ladder crosses over to meet it. Vertically it hangs one
   * shaft below the selection, flipping above when there is no room.
   * Anchor-less (nothing selected / geometry unknown): docked bottom-center —
   * the fallback the visuals doc names.
   */
  private place() {
    const host = this;
    const parent = this.offsetParent as HTMLElement | null;
    if (!parent) return;
    const width = TRAY_WIDTH;
    host.style.setProperty('--tray-w', `${width}px`);
    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const trayH = this.getBoundingClientRect().height || 200;

    const anchor = this.anchor;
    const shaftEl = this.renderRoot.querySelector<HTMLElement>('.shaft');
    if (!anchor) {
      this.removeAttribute('data-flipped');
      this.removeAttribute('data-mirrored');
      if (shaftEl) shaftEl.style.display = 'none';
      host.style.left = `${Math.max(TRAY_EDGE_GAP, (pw - width) / 2)}px`;
      host.style.top = `${Math.max(TRAY_EDGE_GAP, ph - trayH - 18)}px`;
      return;
    }

    this.toggleAttribute('data-mirrored', this.mirrored);
    const wanted = this.mirrored ? anchor.x + anchor.width - width : anchor.x;
    const left = Math.min(
      Math.max(wanted, TRAY_EDGE_GAP),
      Math.max(TRAY_EDGE_GAP, pw - width - TRAY_EDGE_GAP)
    );
    const below = anchor.y + anchor.height + TRAY_SHAFT_H;
    const flip = below + trayH > ph && anchor.y - TRAY_SHAFT_H - trayH > 0;
    // `data-flipped` alone carries this: nothing in render() reads the side
    // any more, so a reactive field would only cost a second update pass.
    this.toggleAttribute('data-flipped', flip);
    host.style.left = `${left}px`;
    host.style.top = `${flip ? anchor.y - TRAY_SHAFT_H - trayH : below}px`;

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

  /** Is a scope being previewed — i.e. is the rung on display one the
   *  selection could still move to? A non-committable row (global) is never a
   *  preview: it is a place to run commands, not a scope to select. */
  private get previewing(): boolean {
    const active = this.rungs.find(r => r.active);
    if (active?.committable === false) return false;
    return this.rungs.some(r => r.holdsSelection && !r.active);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.composedPath()[0] as HTMLElement;
    const inSearch = target instanceof HTMLInputElement;
    if (inSearch && event.code !== 'Escape') return; // typing stays typing

    const consume = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    const previewing = this.previewing;

    switch (event.code) {
      case 'Escape': {
        consume();
        if (inSearch) {
          this.focus();
          return;
        }
        if (previewing) {
          // Escape returns to the rung still holding the selection.
          const home = this.rungs.find(r => r.holdsSelection);
          if (home) this.emit('tray-rung-preview', { key: home.key });
          return;
        }
        this.emit('tray-close', {});
        return;
      }
      // ↑ climbs the ladder and ↓ descends it, exactly as the chip's own ▲▼
      // pair does — one axis, two controls (the spec's rule). Climbing is
      // widening, which is DOWN the drawn column: the ladder reads
      // narrowest-first so `note` can sit at the top, where the chip grew from.
      case 'ArrowUp':
      case 'ArrowDown': {
        consume();
        const idx = this.rungs.findIndex(r => r.active);
        const next = this.rungs[idx + (event.code === 'ArrowUp' ? 1 : -1)];
        if (next) this.emit('tray-rung-preview', { key: next.key });
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
        this.cursorMoved = true;
        return;
      }
      case 'Enter':
      case 'NumpadEnter': {
        consume();
        if (previewing) {
          const active = this.rungs.find(r => r.active);
          if (active) this.emit('tray-rung-commit', { key: active.key });
          return;
        }
        const entry = this.entries()[this.cursorIndex];
        if (entry) this.emit('tray-command', { id: entry.id });
        return;
      }
    }

    // A SECOND slash widens: `/` opened this tray on the selection, so `/`
    // again asks the same question of everything. One key, one escalating
    // meaning — rather than a second chord to remember — and it is why a bare
    // slash never reaches the search box as a character.
    if (!inSearch && event.key === '/') {
      consume();
      this.emit('tray-widen', { text: this.searchText });
      return;
    }

    // Any other printable character jumps focus to the search line (the
    // spec's rule). The triggering character is appended by hand because
    // refocusing mid-keydown does not retarget the insertion.
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

  /**
   * The search line's own text. A slash ANYWHERE in it is the widen gesture,
   * carrying whatever was typed before it: the natural motion is to type a
   * few letters, find the scope too narrow, and reach for `/` again — by
   * which point the caret is past the text, so a leading-slash-only rule
   * would miss the very case it exists for.
   *
   * The cost is that a query cannot contain a slash. No command label does,
   * and "type / to go wider" is worth more than searching for one.
   */
  private onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const slash = input.value.indexOf('/');
    if (slash >= 0) {
      const before = input.value.slice(0, slash);
      input.value = before;
      this.emit('tray-widen', { text: before });
      return;
    }
    this.emit('tray-search', { text: input.value });
  }

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

  /** The tile's caption. The shortcut is already stamped on the tile, so the
   *  tooltip carries the name — and says so when there is no key to stamp. */
  private tipText(tile: TrayTile): string {
    return tile.shortcut ? tile.label : `${tile.label} · unbound`;
  }

  render() {
    const previewing = this.previewing;
    const entries = this.entries();
    const cursorId = entries[this.cursorIndex]?.id;
    return html`
      <div class="shaft" style="display: none"></div>
      <div class="tray">
        <div class="ladder" role="tablist" aria-label="selection scope">
          ${this.rungs.map(
            rung => html`
              <button
                class="rung"
                role="tab"
                aria-current=${rung.active ? 'true' : 'false'}
                @click=${() => this.emit('tray-rung-preview', { key: rung.key })}
              >
                ${rung.label}${rung.holdsSelection && !rung.active
                  ? html`<span class="dot"></span>`
                  : nothing}
              </button>
            `
          )}
        </div>
        <div class="panel">
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
          <div class="grid">
            ${this.tiles.map(
              tile => html`
                <button
                  class="tile ${'arc' in tile.glyph ? 'arc-tile' : ''} ${cursorId === tile.id
                    ? `cursor${this.cursorMoved ? ' cursor-named' : ''}`
                    : ''}"
                  data-state=${tile.state}
                  ?disabled=${tile.state === 'unavailable'}
                  tabindex=${tile.state === 'unavailable' ? '-1' : '0'}
                  aria-label=${tile.label}
                  @click=${() => this.emit('tray-command', { id: tile.id })}
                >
                  ${this.glyph(tile.glyph, 'glyph', GLYPH_TARGET_PX)}
                  <span class="key">${tile.shortcut}</span>
                  <span class="tip">${this.tipText(tile)}</span>
                </button>
              `
            )}
          </div>
          <div class="search">
            <span class="prompt">&gt;</span>
            <input
              .value=${this.searchText}
              placeholder="search this scope · / for everything"
              @input=${(e: Event) => this.onSearchInput(e)}
            />
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-selection-tray': SelectionTray;
  }
}
