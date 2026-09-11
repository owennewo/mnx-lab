import { DISPLAY_CHOICES, type DisplayOptions } from '../engine/displayOptions.ts';
import { LitElement, html, css, svg, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DEFAULT_DISPLAY_PREFERENCES } from './displayDefaults.ts';
import { designTokens, sharedChrome } from './tokens.ts';
import type { ViewMode } from './DocumentViewer.ts';

/**
 * The document settings pad — the leftmost mark in the score-corner cluster,
 * beside the zoom pad. The card holds what changes WHAT is drawn; spacing mode
 * and clearance — how the same score lays out on the same page — live in the
 * zoom pad's footer row, where the other layout levers already were.
 *
 * **This is chrome, not surface** (docs/core-viewer-surface.md): the pad owns
 * no view state. The current view and the views a document can support come in
 * as properties, and choosing one emits `view-change` for the shell to store —
 * a per-browser preference like the zoom, not part of the URL. Living
 * in the cluster rather than the page head also keeps view switching reachable
 * in document focus, which the head tabs never were (the head is removed there).
 *
 * Re-cut 2026-09-09 from the *Settings Card* design canvas
 * (roadmap/proposed/workbench-settings-card.md), five decisions deep:
 *
 *   1. The first row is **STAFF**, not SHOW. It chooses which staff kinds are
 *      drawn; *show* named the verb the whole card performs, and *view* stays
 *      the code's word for the same choice.
 *   2. **A glyph beside each value word** — a small picture of the RESULT, the
 *      word kept for the reader who does not trust the picture. Glyphs on the
 *      row title name the thing rather than the choice; glyphs INSTEAD of the
 *      word leave SHOW/HIDE separable only by a slash.
 *   3. **One control per row, all one width**: glyph · the value in force · a
 *      mark saying what a click does. Two-way rows trail swap arrows and flip;
 *      three-way rows trail a chevron and open a list. The old strip of every
 *      option as a word was ragged — nothing lined up column to column.
 *   4. **The mark idles like the crosshair beside it**: bare, no border, no
 *      shadow, 0.28; 0.55 and accent when a setting is off default; hover
 *      materialises the card AROUND the gear, which becomes its top-right cell.
 *   5. The Unrolled checkbox became the **REPEATS** row, so the card speaks one
 *      vocabulary rather than three.
 *
 * The pose is the zoom pad's, deliberately: one geometry, two states, and the
 * `data-off` idle floor scoped to the closed pose. What the pad does NOT copy
 * is that pad's `renderedExpanded` touch gate: the zoom pad's arms exist in
 * both poses, so a first touch could operate a control the reader cannot see,
 * while this card's fields are not in the DOM at all until it opens. First
 * contact opens; there is nothing else there to hit.
 */

/** The full view vocabulary, in display order — what the STAFF row prints
 *  regardless of what this document can offer. */
const ALL_VIEWS: readonly ViewMode[] = ['notation', 'tab', 'both'];

/** A row's rendered value: what it is worth, what it says, what it draws. */
interface Choice {
  value: string;
  word: string;
  /** Set when this document cannot offer the value — greyed, reason in tooltip. */
  unavailable?: string;
}

const VIEW_WORDS: Record<ViewMode, string> = {
  notation: 'Notation',
  tab: 'Tab',
  both: 'Both'
};

const NO_STRINGS =
  "Needs known strings — declare strings[] in the document, or set a part's instrument override in the HUD";

@customElement('mnx-settings-pad')
export class SettingsPad extends LitElement {
  /** Repeats drawn as written, or unrolled into their performed order. Owned
   *  by the shell, like the view: the pad asks, the shell stores it. */
  @property({ type: Boolean }) unrolled = false;

  /** The view the score is drawing now. */
  @property({ type: String }) view: ViewMode = 'notation';

  /** The views this document can support — ['notation'] when no strings are
   *  known, all three otherwise. The host decides; the pad only renders.
   *  The STAFF list always prints all three: an unavailable view draws greyed
   *  with the reason in its tooltip, because a list holding a single live
   *  option reads as a broken control rather than as "this document has no
   *  fingerboard" — the fact the grey options exist to teach. */
  @property({ attribute: false }) views: ViewMode[] = ['notation'];

  @property({ attribute: false }) display: DisplayOptions = {};

  /**
   * Something more urgent is over the score (the selection tray). Forces the
   * quiet pose even under the pointer — the zoom pad's rule, mirrored so the
   * two neighbouring marks cannot disagree about who yields. No host sets it
   * today; this is a property with a rule, not a wire.
   */
  @property({ type: Boolean, reflect: true }) suppressed = false;

  @state() private open = false;
  /** Which row's list is open, if any. One at a time. */
  @state() private openList: string | null = null;

  private clickAway = (event: PointerEvent) => {
    if (!event.composedPath().includes(this)) this.close();
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.clickAway);
  }

  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.clickAway);
    super.disconnectedCallback();
  }

  private close() {
    this.open = false;
    this.openList = null;
  }

  /**
   * Any setting the reader chose, so the idle mark can say so — the zoom pad's
   * "accent means you chose this" grammar, one level up: there the arms name
   * the axis, here the whole card is one mark and the gear carries it.
   *
   * The VIEW is deliberately excluded. The paper itself shows which staff is
   * drawn, and the URL owns the choice; lighting the gear for it would mark a
   * fresh deep link as modified. `clearance` is excluded for the neighbouring
   * reason: it moved to the zoom pad's footer and belongs to that mark now.
   */
  private get offDefault(): boolean {
    if (this.unrolled) return true;
    return Object.keys(DISPLAY_CHOICES).some(name => {
      const key = name as keyof DisplayOptions;
      const current = this.display[key];
      return current !== undefined && current !== DEFAULT_DISPLAY_PREFERENCES[key];
    });
  }

  private emitDisplay(key: keyof typeof DISPLAY_CHOICES, value: string) {
    this.dispatchEvent(new CustomEvent('display-change', {
      detail: { ...this.display, [key]: value },
      bubbles: true,
      composed: true
    }));
  }

  private emitView(value: ViewMode) {
    this.dispatchEvent(new CustomEvent('view-change', {
      detail: value,
      bubbles: true,
      composed: true
    }));
  }

  private emitUnrolled(value: boolean) {
    this.dispatchEvent(new CustomEvent('unrolled-change', {
      detail: value,
      bubbles: true,
      composed: true
    }));
  }

  // ── glyph primitives ────────────────────────────────────────────────────
  // Drawn, never imported — the cluster's rule. One 24-unit box, currentColor,
  // square caps, so a value glyph sits beside the focus and spacing glyphs in
  // the zoom pad's footer without looking borrowed from somewhere else.

  private static stroke(d: string, w = 1.6) {
    return svg`<path d=${d} fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="square"></path>`;
  }

  /** Staff lines: the ground almost every one of these glyphs stands on. */
  private static staffLines(ys: number[], x1 = 3, x2 = 21, w = 1.1) {
    return SettingsPad.stroke(ys.map(y => `M${x1} ${y}h${x2 - x1}`).join(''), w);
  }

  /** A notehead: an ellipse at the engraver's angle, never a circle. */
  private static head(cx: number, cy: number, rx = 2.8, ry = 2) {
    return svg`<ellipse cx=${cx} cy=${cy} rx=${rx} ry=${ry}
      transform=${`rotate(-20 ${cx} ${cy})`} fill="currentColor"></ellipse>`;
  }

  private static dot(cx: number, cy: number, r: number) {
    return svg`<circle cx=${cx} cy=${cy} r=${r} fill="currentColor"></circle>`;
  }

  /** HIDE is always its SHOW glyph plus this — one drawing and its negation. */
  private static get slash() {
    return SettingsPad.stroke('M4 20 20 4', 1.8);
  }

  /**
   * The value glyphs, by row and value. Twenty-two drawings, from the canvas.
   *
   * Built per call rather than held in a module constant: a `TemplateResult` is
   * a description, not a node, so there is nothing to reuse — and a table built
   * at module scope would fix the glyphs before `svg` had anything to bind.
   */
  private static glyph(key: string, value: string, px = 14): TemplateResult {
    const S = SettingsPad;
    const fiveLines = S.staffLines([5, 8.5, 12, 15.5, 19]);
    const quietStaff = S.staffLines([5, 8.5, 12, 15.5, 19], 3, 21, 0.9);
    const timeSig = S.stroke('M15.5 8.3A5 5 0 1 0 15.5 15.7', 2.4);
    // The F clef: the one clef that still reads honestly at 12px.
    const fClef = svg`${S.dot(6.3, 9.2, 1.7)}${S.stroke(
      'M6.3 9.2c0-3 2.4-5 5.4-5 3.4 0 5.6 2.4 5.6 5.4 0 5-4.8 9-9.8 11', 1.8
    )}${S.dot(20.6, 7.6, 1.3)}${S.dot(20.6, 11.6, 1.3)}`;
    const titleMark = svg`${S.stroke('M6 5h12', 2.6)}${S.stroke('M4 11.5h16M4 15.5h16M4 19.5h10', 1.2)}`;
    const beamHeads = svg`${S.head(7, 19.3, 2.6, 1.9)}${S.head(16, 19.3, 2.6, 1.9)}`;
    const lyricNote = svg`${S.head(9.5, 7.8, 2.7, 1.9)}${S.stroke('M12 7.2V1.5', 1.5)}`;
    const twoSystems = svg`${S.stroke('M9 4v5M9 15v5', 1.6)}${S.staffLines([4, 6.5, 9], 10, 22, 1)}${S.staffLines([15, 17.5, 20], 10, 22, 1)}`;
    const barGround = S.staffLines([11, 14.5, 18], 2, 22);

    const drawings: Record<string, TemplateResult> = {
      // STAFF — what kind of staff the page draws. The tab glyph's knock-out is
      // --surface, never white: this card sits on paper that goes dark too.
      // Four lines and five, not the honest five and six: at 14px a 24-unit
      // box gives 0.58px per unit, so a real staff's 3.5-unit gaps close up
      // into one grey block and all three views draw the same smudge. The
      // count is not what tells them apart — the gap, the fret block and the
      // two groups are.
      'view.notation': svg`${S.staffLines([5, 9.5, 14, 18.5])}`,
      'view.tab': svg`${S.staffLines([4, 8, 12, 16, 20], 3, 21, 1)}
        <rect x="8.6" y="7.6" width="6.8" height="8.8" fill="var(--surface)"></rect>
        <rect x="10" y="9.4" width="4" height="5.2" fill="currentColor"></rect>`,
      'view.both': svg`${S.staffLines([3, 6.5, 10], 3, 21, 1)}${S.staffLines([15.5, 19, 22.5], 3, 21, 1)}`,
      // REPEATS — the barline that sends you back, and the same bar opened out.
      'repeats.as-written': svg`${quietStaff}${S.stroke('M16 4.5v15', 2.6)}
        ${S.stroke('M12.5 4.5v15', 1.2)}${S.dot(8.5, 10.2, 1.4)}${S.dot(8.5, 13.8, 1.4)}`,
      'repeats.unrolled': svg`${quietStaff}${S.stroke('M8 4.5v15M16 4.5v15', 1.2)}
        ${S.stroke('M3 1.5h5M16 1.5h5', 1.4)}`,
      // LYRICS — a note over the words under it.
      'lyrics.all': svg`${S.head(9.5, 5.6, 2.4, 1.7)}${S.stroke('M11.8 5V1', 1.4)}
        ${S.stroke('M4 12h16M4 16h16M4 20h9', 1.3)}`,
      'lyrics.current': svg`${lyricNote}${S.stroke('M4 16h16', 1.5)}`,
      'lyrics.hide': svg`${lyricNote}${S.stroke('M4 16h16', 1.5)}${S.slash}`,
      'timeSignatures.show': svg`${quietStaff}${timeSig}`,
      'timeSignatures.hide': svg`${quietStaff}${timeSig}${S.slash}`,
      'clefs.show': svg`${fClef}`,
      'clefs.hide': svg`${fClef}${S.slash}`,
      'title.show': svg`${titleMark}`,
      'title.hide': svg`${titleMark}${S.slash}`,
      // BAR NUMBERS — the numeral where it lands: over every bar, or once.
      'barNumbers.every-bar': svg`${barGround}${S.stroke('M8 11v7M16 11v7', 1.6)}
        ${S.stroke('M6.6 6.5l1.3-1.2v3.6M14.6 6.5l1.3-1.2v3.6', 1.3)}`,
      'barNumbers.every-system': svg`${barGround}${S.stroke('M13 11v7', 1.6)}
        ${S.stroke('M2.6 6.5l1.3-1.2v3.6', 1.3)}`,
      'barNumbers.hide': svg`${barGround}${S.stroke('M13 11v7', 1.6)}${S.slash}`,
      // INSTRUMENT NAMES — the name stub beside each system, or only the first.
      'instrumentNames.every-system': svg`${S.stroke('M2 6.5h4M2 17.5h4', 1.5)}${twoSystems}`,
      'instrumentNames.first-system': svg`${S.stroke('M2 6.5h4', 1.5)}${twoSystems}`,
      'instrumentNames.hide': svg`${twoSystems}${S.slash}`,
      // BEAMS — the same two stems, beam slanted or level.
      'beams.slanted': svg`${S.stroke('M9.2 19V8.5M18.2 19V5.5', 1.6)}
        ${S.stroke('M9.2 8.5 18.2 5.5', 3)}${beamHeads}`,
      'beams.flat': svg`${S.stroke('M9.2 19V7M18.2 19V7', 1.6)}
        ${S.stroke('M9.2 7h9', 3)}${beamHeads}`
    };

    return html`<svg width=${px} height=${px} viewBox="0 0 24 24" aria-hidden="true"
      >${drawings[`${key}.${value}`] ?? fiveLines}</svg
    >`;
  }

  /** The mark. Eight teeth as a dashed ring over the wheel; dash+gap ≈ 2πr/8
   *  keeps them even all the way round. Drawn at the full 24 rather than the
   *  16 it used inside its retired border: without that box the glyph IS the
   *  mark, and it has to carry the same presence as the 24px crosshair. */
  private gearGlyph() {
    return svg`
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3.4"
          stroke-dasharray="3.14 3.14" stroke-dashoffset="1.57"></circle>
        <circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"></circle>
        <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
      </svg>
    `;
  }

  /** Two-way: the click flips it. */
  private swapGlyph() {
    return svg`
      <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.5 5.5h10l-2.6-2.6M13.5 10.5h-10l2.6 2.6"
          fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"></path>
      </svg>
    `;
  }

  /** Three-way: the click opens the list. */
  private chevronGlyph() {
    return svg`
      <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor"
          stroke-width="1.6" stroke-linecap="square"></path>
      </svg>
    `;
  }

  // ── rows ────────────────────────────────────────────────────────────────

  /**
   * One row: its name in the label column, one field in the control column.
   * Both cells carry the separating rule, so it runs the card's full width.
   *
   * Two choices become a button that flips; three become a button that opens a
   * list. The reason is not economy of pixels — a two-valued setting has
   * nothing to choose BETWEEN once the current value is on screen, so a list
   * there would be two clicks to say one bit.
   */
  private row(
    key: string,
    label: string,
    choices: Choice[],
    current: string,
    select: (value: string) => void,
    hot = false
  ) {
    const index = choices.findIndex(choice => choice.value === current);
    const shown = choices[index] ?? choices[0];
    const other = choices[(index + 1) % choices.length];
    const twoWay = choices.length === 2;
    const listOpen = this.openList === key;
    const sentence = twoWay
      ? `${label}: ${shown.word.toLowerCase()} — click for ${other.word.toLowerCase()}`
      : `${label}: ${shown.word.toLowerCase()}`;

    return html`
      <div class="cell lbl">${label}</div>
      <div class="cell control">
        <button
          type="button"
          class="field ${hot ? 'hot' : ''}"
          data-row=${key}
          title=${sentence}
          aria-label=${sentence}
          aria-haspopup=${twoWay ? nothing : 'menu'}
          aria-expanded=${twoWay ? nothing : listOpen}
          @click=${() => {
            if (twoWay) select(other.value);
            else this.openList = listOpen ? null : key;
          }}
        >
          ${SettingsPad.glyph(key, shown.value)}
          <span class="word">${shown.word}</span>
          ${twoWay ? this.swapGlyph() : this.chevronGlyph()}
        </button>
        ${listOpen ? this.list(key, label, choices, current, select) : nothing}
      </div>
    `;
  }

  /**
   * The list, in the card's own DOM — which is what keeps the card open beneath
   * it. `pointerleave` fires on the outer element and the list is a descendant,
   * so no holding logic is owed here at all.
   */
  private list(
    key: string,
    label: string,
    choices: Choice[],
    current: string,
    select: (value: string) => void
  ) {
    return html`
      <div
        class="menu"
        role="menu"
        aria-label=${label}
        @keydown=${(event: KeyboardEvent) => this.listKeys(event)}
      >
        ${choices.map(choice => {
          const on = choice.value === current;
          if (choice.unavailable) {
            return html`<span class="item off" title=${choice.unavailable} aria-disabled="true"
              >${SettingsPad.glyph(key, choice.value)}<span class="word">${choice.word}</span></span
            >`;
          }
          return html`<button
            type="button"
            class="item row-state ${on ? 'row-current' : ''}"
            role="menuitemradio"
            aria-checked=${on}
            @click=${() => {
              // Focus MOVES BEFORE the list is dropped, and the order is
              // load-bearing: closing first destroys the focused item, which
              // fires `focusout` with a null `relatedTarget` and takes the
              // whole card down with it. Handing focus back to the trigger
              // first makes that a move within the card instead.
              this.focusField(key);
              select(choice.value);
              this.openList = null;
            }}
            >${SettingsPad.glyph(key, choice.value)}<span class="word">${choice.word}</span></button
          >`;
        })}
      </div>
    `;
  }

  /** Synchronous by design — see the call site in `list()`: the field is
   *  already on screen (it is the trigger), and focus has to land there before
   *  the list it came from is removed. */
  private focusField(key: string) {
    this.renderRoot.querySelector<HTMLButtonElement>(`.field[data-row="${key}"]`)?.focus();
  }

  /** Arrow keys walk the open list; Home and End jump. Escape is handled one
   *  level up, where "close the list" and "close the card" can be told apart. */
  private listKeys(event: KeyboardEvent) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...this.renderRoot.querySelectorAll<HTMLElement>('.menu .item:not(.off)')];
    if (!items.length) return;
    const at = items.indexOf(this.shadowRoot?.activeElement as HTMLElement);
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (at + 1 + items.length) % items.length
      : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  private displayRow(
    key: keyof typeof DISPLAY_CHOICES,
    label: string,
    words: readonly string[]
  ) {
    const choices: Choice[] = DISPLAY_CHOICES[key].map((value, i) => ({
      value,
      word: words[i]
    }));
    const fallback = DEFAULT_DISPLAY_PREFERENCES[key] as string;
    const current = (this.display[key] as string | undefined) ?? fallback;
    return this.row(
      key,
      label,
      choices,
      current,
      value => this.emitDisplay(key, value),
      current !== fallback
    );
  }

  private staffRow() {
    const choices: Choice[] = ALL_VIEWS.map(view => ({
      value: view,
      word: VIEW_WORDS[view],
      unavailable: this.views.includes(view) ? undefined : NO_STRINGS
    }));
    return this.row('view', 'Staff', choices, this.view, value => this.emitView(value as ViewMode));
  }

  private repeatsRow() {
    const choices: Choice[] = [
      { value: 'as-written', word: 'As written' },
      { value: 'unrolled', word: 'Unrolled' }
    ];
    return this.row(
      'repeats',
      'Repeats',
      choices,
      this.unrolled ? 'unrolled' : 'as-written',
      value => this.emitUnrolled(value === 'unrolled'),
      this.unrolled
    );
  }

  static styles = [
    designTokens,
    sharedChrome,
    css`
      :host {
        display: block;
        font-family: var(--sans);
        /* The 44px grabbable area around a 24px mark, the zoom pad's recipe:
           the padding is part of the target, and the negative margin keeps the
           MARGIN box 24px so the gear and the crosshair stay level in the
           cluster's flex row. */
        padding: 10px;
        margin: -10px;
      }

      /* Exactly the mark's box, so the card can hang off its corner.
         The 2px offset is not a nudge: the crosshair beside this one sits
         INSIDE the zoom pad's 2px border, so its 24px glyph box starts two
         pixels below the cluster's top edge. A bare mark flush to that edge
         rides two pixels high against its neighbour — visible, because the two
         marks are 5px apart. The card takes the same two pixels back in its own
         top and right offsets, so its border lands where the zoom pad's does. */
      .anchor {
        position: relative;
        width: 24px;
        height: 24px;
        margin: var(--rule-w) 0 0;
      }

      /* ── the mark ──
         One button in both poses. Idle it is a bare glyph at 0.28 — no border,
         no ground, no shadow — because the crosshair beside it is a bare glyph
         at 0.28, and two neighbouring marks that idle differently read as two
         unrelated controls rather than as one family. Open, the same button
         becomes the card's top-right cell. */
      button.gear {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 5;
        width: 24px;
        height: 24px;
        display: grid;
        place-items: center;
        color: var(--ink);
        opacity: 0.28;
        cursor: pointer;
        transition:
          opacity 0.12s ease,
          color 0.12s ease;
      }

      button.gear svg {
        display: block;
      }

      /* Off default: the idle floor rises and the mark takes the accent, so the
         corner never lies about what the score is hiding. */
      :host([data-off]) button.gear {
        opacity: 0.55;
        color: var(--accent);
      }

      /* Open or under the pointer, at full strength — declared AFTER the
         off-default floor so it wins on both properties at equal weight. */
      :host([data-open]) button.gear,
      button.gear:hover,
      button.gear:focus-visible {
        opacity: 1;
        color: var(--accent);
      }

      button.gear:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: 2px;
      }

      /* The tray's claim beats both, so it comes last at matching weight. */
      :host([suppressed]) button.gear {
        opacity: 0.28;
        color: var(--ink);
      }

      /* ── the card ──
         Hung from the mark's own corner rather than dropped below it on a
         bridge: the header's right-hand cell IS the mark's square, so the card
         grows around the gear the way the zoom pad grows around its crosshair.
         Right edge anchored, so it opens leftward and downward and never
         covers its neighbour. */
      .card {
        position: absolute;
        /* Out by the border width, so the card's INK EDGE lands on the
           cluster's top-right corner and its header cell lands exactly on the
           mark — the same corner the zoom pad's border occupies. */
        top: calc(-1 * var(--rule-w));
        right: calc(-1 * var(--rule-w));
        z-index: 4;
        box-sizing: border-box;
        width: max-content;
        max-width: calc(100vw - 110px);
        background: var(--surface);
        border: var(--rule-w) solid var(--ink);
        border-radius: var(--radius-card);
        box-shadow: 0 2px 4px var(--shadow-far), 0 12px 30px var(--shadow-far);
      }

      /* The header, in the zoom pad readout's voice: a context ground, a
         hairline before the mark's cell, an ink rule under the whole row. */
      .head {
        display: flex;
        align-items: stretch;
        /* 24 for the mark's cell plus the rule under the row: the gear's
           square has to survive the sheet's border-box sizing intact. */
        height: calc(24px + var(--rule-w));
        background: var(--bg-context);
        border-bottom: var(--rule-w) solid var(--ink);
      }

      .head .name {
        flex: 1;
        display: flex;
        align-items: center;
        padding: 0 10px;
      }

      /* The gear's cell. The button paints the glyph; this paints the ground,
         so neither has to know about the other's state. */
      .head .slot {
        width: 24px;
        border-left: 1px solid var(--line);
        background: var(--row-current);
      }

      .body {
        padding: 4px 10px 8px;
      }

      /* ── the rows ──
         Two columns, so the labels line up down one edge and the controls down
         the other. The control column is sized by the widest FIELD rather than
         by a literal, and every field fills it — which is what makes the
         alignment survive a font that is not Archivo. */
      .rows {
        display: grid;
        grid-template-columns: max-content max-content;
        column-gap: 10px;
        align-items: center;
      }

      .cell {
        display: flex;
        align-items: center;
        min-height: 26px;
      }

      /* Every cell but the first row's pair carries the rule, so it runs
         unbroken across both columns. */
      .rows > .cell:nth-child(n + 3) {
        border-top: 1px solid var(--line);
      }

      .cell.control {
        position: relative;
      }

      .lbl {
        font: 600 8px/1 var(--sans);
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ink-2);
        white-space: nowrap;
      }

      /* ── the field ──
         The retired option strip's vocabulary — uppercase 600, tracked — now
         printing ONE value: the one in force. The trailing mark is the whole
         affordance: swap arrows mean this click changes it, a chevron means
         this click shows you the rest. */
      .field {
        box-sizing: border-box;
        width: 100%;
        height: 22px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 4px;
        border: 0;
        border-bottom: 1px solid var(--line-strong);
        border-radius: 0;
        background: transparent;
        color: var(--ink);
        font: 600 10px/1 var(--sans);
        letter-spacing: 0.11em;
        text-transform: uppercase;
        white-space: nowrap;
        cursor: pointer;
        transition:
          color 0.12s ease,
          background-color 0.12s ease;
      }

      .field .word {
        flex: 1;
        text-align: left;
      }

      .field svg {
        display: block;
        flex: none;
      }

      /* Accent means "you chose this" — the readout's rule, per row. */
      .field.hot {
        color: var(--accent-fg);
      }

      .field:hover,
      .field:focus-visible {
        background: var(--bg-context);
        color: var(--accent);
      }

      .field:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: -2px;
      }

      /* ── the list ──
         Under its own field, at the field's width, inside the card. Offset from
         the row's middle rather than its bottom so it clears the 22px field
         whatever the row grows to. */
      .menu {
        position: absolute;
        top: calc(50% + 11px);
        left: 0;
        z-index: 3;
        width: 100%;
        background: var(--surface);
        border: 1px solid var(--line-strong);
        box-shadow: 0 2px 4px var(--shadow-far);
      }

      .menu .item {
        box-sizing: border-box;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 6px;
        height: 26px;
        padding: 0 8px 0 6px;
        border-radius: 0;
        /* No background declaration here, on purpose: the row-current class
           from sharedChrome carries the chosen item's tint at the SAME
           specificity, and this block is composed after it — a transparent
           declared here silently wins and the chosen value loses the one
           ground that marks it. The element default is transparent anyway. */
        color: var(--ink-2);
        font: 600 10px/1 var(--sans);
        letter-spacing: 0.11em;
        text-transform: uppercase;
        white-space: nowrap;
        text-decoration: none;
        cursor: pointer;
      }

      .menu a.item:hover {
        text-decoration: none;
      }

      .menu .item svg {
        display: block;
        flex: none;
      }

      .menu .item:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: -2px;
      }

      /* A view this document cannot offer: same slot, greyed, the reason in
         its tooltip. Not display:none — absence reads as a broken control,
         grey reads as "possible, not here". */
      .menu .item.off {
        color: var(--ink-faint);
        cursor: help;
      }

      .help {
        margin: 8px 0 2px;
        /* Narrower than the grid, so the prose can never be the thing that
           decides how wide the card is. */
        max-width: 264px;
        color: var(--ink-2);
        font: 11px/1.4 var(--sans);
      }

      @media (prefers-reduced-motion: reduce) {
        button.gear,
        .field {
          transition: none;
        }
      }
    `
  ];

  updated() {
    this.toggleAttribute('data-open', this.open && !this.suppressed);
    this.toggleAttribute('data-off', this.offDefault);
  }

  render() {
    return html`
      <div
        class="anchor"
        @pointerenter=${() => (this.open = true)}
        @pointerleave=${() => {
          // An OPEN LIST is the one thing that holds the card: the reader is
          // mid-choice, and collapsing the card out from under a menu they are
          // reaching for is the same mistake as dropping a slider mid-drag.
          // Otherwise the pointer leaving means done — including when a click
          // left focus on a field, which is why the focus is dropped rather
          // than treated as a reason to stay.
          if (this.openList) return;
          const active = this.shadowRoot?.activeElement;
          if (active instanceof HTMLElement && this.renderRoot.querySelector('.card')?.contains(active)) {
            active.blur();
          }
          this.close();
        }}
        @focusin=${() => (this.open = true)}
        @focusout=${(e: FocusEvent) => {
          if (!this.renderRoot.contains(e.relatedTarget as Node | null)) this.close();
        }}
        @keydown=${(e: KeyboardEvent) => {
          // Native button and link keys belong to this card. The page listens
          // on window; letting Space/Enter bubble would edit the score and
          // cancel the button's default activation before it could change a
          // preference.
          e.stopPropagation();
          if (e.key !== 'Escape' || !this.open) return;
          e.preventDefault();
          // One Escape per layer — the list first, the card second. Closing
          // both at once loses the reader their place for no gain.
          if (this.openList) {
            this.focusField(this.openList);
            this.openList = null;
            return;
          }
          this.renderRoot.querySelector<HTMLButtonElement>('.gear')?.focus();
          this.open = false;
        }}
      >
        <button
          class="gear"
          type="button"
          title="Document settings"
          aria-label="Document settings"
          aria-expanded=${this.open && !this.suppressed}
          @click=${() => (this.open = true)}
        >
          ${this.gearGlyph()}
        </button>
        ${this.open && !this.suppressed
          ? html`
              <div class="card">
                <div class="head">
                  <span class="name lbl">Settings</span>
                  <span class="slot"></span>
                </div>
                <div class="body">
                  <div class="rows">
                    ${this.staffRow()}
                    ${this.repeatsRow()}
                    ${this.displayRow('lyrics', 'Lyrics', ['All verses', 'Current verse', 'Hide'])}
                    ${this.displayRow('timeSignatures', 'Time signatures', ['Show', 'Hide'])}
                    ${this.displayRow('clefs', 'Clefs', ['Show', 'Hide'])}
                    ${this.displayRow('title', 'Title', ['Show', 'Hide'])}
                    ${this.displayRow('barNumbers', 'Bar numbers', ['Every bar', 'Every system', 'Hide'])}
                    ${this.displayRow('instrumentNames', 'Instrument names', ['Every system', 'First system', 'Hide'])}
                    ${this.displayRow('beams', 'Beams', ['Slanted', 'Flat'])}
                  </div>
                  <p class="help">Current verse uses the first used verse in the document’s verse order until playback supplies a selected verse.</p>
                  <p class="help">A system is one horizontal row of music, including notation and tab together in Both.</p>
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-settings-pad': SettingsPad;
  }
}
