/**
 * The rung inspector (roadmap/inprogress/workbench-rung-inspector.md): the
 * cursor's path as a breadcrumb of identity pills, the rung's state as
 * attribute pills, and a blank slot — one line, over the score, where the
 * tray sits. Design: https://claude.ai/code/artifact/6d09ff2a-d82a-4cba-a653-3d4245fa26a3
 *
 * NEUTRAL, like the tray: it renders what the page hands it and emits what
 * the user asked for. It never parses a line and never fires an op — the
 * page's inspectorRows.ts does both — so the component can be judged on its
 * keys alone.
 *
 * ONE RULE ABOUT BARE TYPING. Two states, always visible by whether a caret
 * sits inside a pill:
 *   walking — ↑↓ the ladder · ←→ step siblings at this rung · Tab walks the
 *             frame · Enter opens · typing goes to the blank slot · ⌫ clears
 *             then removes · `/` widens · Esc closes
 *   editing — typing filters · ↑↓ cycles candidates · Enter commits · Esc
 *             closes the pill
 * Go-to (a crumb's siblings) and amend (a pill's value) are reached only by
 * opening something first, so they never compete with add.
 *
 * Tokens reach here by INHERITANCE from <mnx-workbench>'s host (the same
 * rule the tray lives under, and the same design-tokens test).
 */
import { LitElement, html, css, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { EditorIntent } from '../edit/intents.ts';
import type { InspectorCrumb, InspectorPill, InspectorWord } from '../edit/inspector.ts';
import { OVERLAY_SHAFT_H, placeOverlay, type OverlayAnchor } from './overlayPlacement.ts';

export const INSPECTOR_WIDTH = 470;
const INSPECTOR_MIN_H = 96;
/** One row of the body — the window's rows and the attribute rows share it. */
const ROW_H = 30;

/** What is open for editing: a crumb (go to), a pill (amend) or the slot (add). */
type Open =
  | { kind: 'crumb'; index: number }
  | { kind: 'pill'; index: number; cleared: boolean }
  | { kind: 'slot' };

interface Candidate {
  label: string;
  detail: string;
  current?: boolean;
  intent?: EditorIntent;
  /** For the slot: completing to this word (then its value). */
  word?: string;
}

const X_GLYPH = svg`<svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1l-6 6"></path></svg>`;
const FLOOR_GLYPH = svg`<svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1 3l3 3 3-3"></path></svg>`;

@customElement('mnx-rung-inspector')
export class RungInspector extends LitElement {
  @property({ attribute: false }) crumbs: InspectorCrumb[] = [];
  @property({ attribute: false }) pills: InspectorPill[] = [];
  @property({ attribute: false }) words: InspectorWord[] = [];
  @property({ type: String }) secondary = '';
  @property({ attribute: false }) note: string | null = null;
  @property({ attribute: false }) error: string | null = null;
  @property({ attribute: false }) anchor: OverlayAnchor | null = null;
  /** Decided by the page at open and held — the same rule as the tray. */
  @property({ type: Boolean }) mirrored = false;

  /** The walking cursor: an index over crumbs, then pills, then the slot. */
  @state() private cursor = 0;
  @state() private open: Open | null = null;
  @state() private text = '';
  @state() private menuIndex = 0;
  /** Pills below the fold of rows 2–3, counted after layout for the badge. */
  @state() private overflow = 0;
  /** The key legend is on request: `?` (typed, or the foot's button). */
  @state() private showKeys = false;

  static styles = css`
    :host {
      position: absolute;
      z-index: 30;
      display: block;
      width: var(--tray-w, 470px);
      font-family: var(--sans);
      outline: none;
      transition:
        left 0.16s ease,
        top 0.16s ease;
    }

    .shaft {
      position: absolute;
      height: ${OVERLAY_SHAFT_H}px;
      background: var(--accent);
    }

    :host(:not([data-flipped])) .shaft {
      bottom: 100%;
    }

    :host([data-flipped]) .shaft {
      top: 100%;
    }

    .box {
      box-sizing: border-box;
      width: 100%;
      max-height: var(--tray-max-h, none);
      overflow: auto;
      background: var(--surface);
      border: 1px solid var(--ink);
      box-shadow: 0 14px 34px color-mix(in oklab, var(--ink), transparent 78%);
      display: flex;
      flex-direction: column;
    }

    /* ── the state word and the ? sit at the right of the slot row: no row
       of their own, so the frame is three rows until the legend is asked for. */
    .slotrow .state {
      margin-left: auto;
      flex: none;
      font: 600 8.5px/1.2 var(--sans);
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--ink-3);
    }

    .slotrow .state.editing {
      color: var(--accent-fg);
    }

    .slotrow .secondary {
      flex: none;
      font: 400 10px/1.2 var(--mono);
      color: var(--ink-3);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slotrow .help {
      flex: none;
      margin-left: 8px;
      font: 500 10px/1 var(--mono);
      color: var(--ink-3);
      background: none;
      border: 1px solid var(--line-strong);
      padding: 2px 5px;
      cursor: pointer;
    }

    .slotrow .help.on {
      color: var(--ink);
      border-color: var(--accent);
    }

    /* ── the body: a HARD three rows (the design's rule). Row 1 is the add
       slot; rows 2–3 hold the existing pills, wrapping, and what does not fit
       scrolls behind a +N badge. The rung window on the left is the same
       three rows: the rung above, the CURRENT rung, the rung below. */
    .body {
      display: flex;
      align-items: stretch;
      height: ${3 * ROW_H}px;
    }

    .window {
      width: 118px;
      flex: none;
      border-right: 1px solid var(--line);
      background: var(--bg-context);
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .rung {
      display: flex;
      align-items: center;
      gap: 6px;
      height: ${ROW_H}px;
      box-sizing: border-box;
      padding: 0 10px;
      font: 500 11px/1.2 var(--mono);
      color: var(--ink-3);
      white-space: nowrap;
      overflow: hidden;
      cursor: default;
    }

    .rung .idx {
      color: var(--ink-faint);
    }

    /* The rows either side are glimpses — they say where ↑↓ will take you —
       and fade off the edge like a wheel. */
    .rung.above,
    .rung.below {
      opacity: 0.55;
    }

    .rung.above {
      mask-image: linear-gradient(to bottom, transparent 0, black 45%);
    }

    .rung.below {
      mask-image: linear-gradient(to top, transparent 0, black 45%);
    }

    .rung.empty {
      color: var(--ink-faint);
      font-style: italic;
    }

    .rung.cur {
      color: var(--ink);
      background: var(--row-current);
      border-left: 3px solid var(--accent);
      padding-left: 7px;
      opacity: 1;
    }

    .rung.cur .idx {
      color: var(--ink-2);
    }

    .rung.cur.cursor {
      outline: 1px solid var(--accent);
      outline-offset: -1px;
    }

    .rung.cur.open {
      background: var(--surface);
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }

    .attrs {
      flex: 1;
      min-width: 0;
      display: grid;
      grid-template-rows: ${ROW_H}px ${2 * ROW_H}px;
      position: relative;
    }

    .slotrow {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 9px;
      border-bottom: 1px solid var(--line);
    }

    .pills {
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 4px 5px;
      padding: 5px 9px;
      overflow-y: auto;
      scrollbar-width: none;
    }

    .more {
      position: absolute;
      right: 6px;
      bottom: 4px;
      font: 500 9px/1 var(--mono);
      color: var(--ink-faint);
      background: var(--surface);
      padding: 2px 4px;
      border: 1px solid var(--line);
      pointer-events: none;
    }

    /* The pill is the rung chip's box: the same lowercase mono word, the
       same 1px line-strong border, so a crumb and the chip read as one. */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 7px;
      border: 1px solid var(--line-strong);
      background: var(--surface);
      font: 500 11px/1.2 var(--mono);
      color: var(--ink);
      white-space: nowrap;
      cursor: default;
    }

    .pill .k {
      color: var(--ink-3);
    }

    .pill.inherited {
      color: var(--ink-3);
      border-style: dotted;
    }

    /* Derived: the renderer's answer, not the document's — dotted like a
       reading, but in full ink because it can be opened and overridden. */
    .pill.derived {
      color: var(--ink-3);
      border-style: dotted;
    }

    /* The cursor is ALWAYS drawn: the tile cursor's own fill and border,
       plus a ring so it survives on a crumb that is already accent-bordered. */
    .pill.cursor {
      background: var(--row-current);
      border-color: var(--accent);
      outline: 1px solid var(--accent);
      outline-offset: 1px;
    }

    /* Over a range: the mixed-checkbox convention — set on some members. */
    .pill.half {
      opacity: 0.55;
      border-style: dashed;
    }

    .pill.open {
      border: 2px solid var(--accent);
      padding: 3px 6px;
      background: var(--surface);
    }

    .pill svg {
      width: 8px;
      height: 8px;
      stroke: var(--ink-3);
      stroke-width: 1.5;
      fill: none;
      display: block;
      margin-right: -2px;
    }

    .pill.floor svg {
      stroke: var(--ink-faint);
    }

    .pill input,
    .slot input {
      font: inherit;
      color: var(--ink);
      background: transparent;
      border: none;
      outline: none;
      padding: 0;
      min-width: 3ch;
    }

    .pill input::selection,
    .slot input::selection {
      background: color-mix(in oklab, var(--accent) 22%, transparent);
    }

    .slot {
      display: inline-flex;
      align-items: center;
      min-width: 120px;
      padding: 3px 6px;
      border-bottom: 1px solid var(--line-strong);
      color: var(--ink-faint);
      font: 500 11px/1.2 var(--mono);
    }

    .slot.cursor {
      border-bottom-color: var(--accent);
      color: var(--ink-3);
      background: var(--row-current);
    }

    .slot.open {
      border-bottom-color: var(--accent);
      color: var(--ink);
    }

    .slot .hint {
      color: var(--ink-faint);
      margin-left: 6px;
    }

    .menu {
      position: absolute;
      left: 127px;
      top: ${ROW_H + 6}px;
      z-index: 2;
      width: max-content;
      max-width: calc(100% - 136px);
      min-width: 150px;
      max-height: ${5 * ROW_H}px;
      overflow-y: auto;
      border: 1px solid var(--line-strong);
      background: var(--surface);
      box-shadow: 0 8px 20px color-mix(in oklab, var(--ink), transparent 80%);
      display: flex;
      flex-direction: column;
    }

    .menu.for-rung {
      left: 6px;
      top: ${2 * ROW_H + 2}px;
    }

    .menu.for-pill {
      top: ${2 * ROW_H + 6}px;
    }

    .menu .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      padding: 4px 8px;
      font: 500 10.5px/1.35 var(--mono);
      color: var(--ink-2);
      border-left: 2px solid transparent;
      cursor: pointer;
    }

    .menu .row .m {
      color: var(--ink-3);
    }

    .menu .row.cur {
      background: var(--row-current);
      color: var(--ink);
      border-left-color: var(--accent);
    }

    .menu .row.current .l::after {
      content: ' ◂';
      color: var(--ink-3);
    }

    .keys {
      display: flex;
      flex-wrap: wrap;
      gap: 0 14px;
      padding: 5px 9px 6px;
      border-top: 1px solid var(--line);
      background: var(--bg-context);
      background: var(--bg-context);
      font: 400 10px/1.5 var(--mono);
      color: var(--ink-3);
    }

    .keys b {
      font-weight: 500;
      color: var(--ink);
    }

    .note,
    .error {
      padding: 0 9px 7px;
      font: 400 10px/1.4 var(--sans);
      color: var(--ink-3);
    }

    .error {
      color: var(--accent-fg);
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
    // The cursor starts on the ADD slot — the first row, and where bare
    // typing lands anyway — so the frame opens ready to take an attribute.
    this.cursor = 1;
    this.focus();
  }

  updated(changed: Map<string | number | symbol, unknown>) {
    if (changed.has('crumbs') || changed.has('pills')) {
      // The window always shows the current rung in its middle row, so the
      // cursor has nothing to follow: item 0 IS "the rung you are on".
      this.cursor = Math.min(this.cursor, this.itemCount() - 1);
    }
    this.countOverflow();
    placeOverlay(this, {
      anchor: this.anchor,
      mirrored: this.mirrored,
      width: INSPECTOR_WIDTH,
      minHeight: INSPECTOR_MIN_H,
      shaft: this.renderRoot.querySelector<HTMLElement>('.shaft')
    });
    if (changed.has('open') && this.open) {
      const input = this.renderRoot.querySelector<HTMLInputElement>('input');
      if (input) {
        input.focus();
        // Amend opens with the VALUE selected — key fixed, value highlighted —
        // so typing replaces it (the rename-a-file convention).
        if (this.open.kind === 'pill' && !this.open.cleared) input.select();
      }
    } else if (changed.has('open') && !this.open) {
      this.focus();
    }
  }

  private countOverflow(): void {
    const box = this.renderRoot.querySelector<HTMLElement>('.pills');
    if (!box) return;
    const floor = box.getBoundingClientRect().bottom;
    const hidden = [...box.querySelectorAll<HTMLElement>('.pill')].filter(
      p => p.getBoundingClientRect().top >= floor - 1
    ).length;
    if (hidden !== this.overflow) this.overflow = hidden;
  }

  // ── the item row: the rung, the slot, the pills ───────────────────────────

  /** Walk order: the current rung's row, then the add slot, then the pills —
   *  the reading order of the frame (window, row 1, rows 2–3). */
  private itemCount(): number {
    return 2 + this.pills.length;
  }

  private itemAt(index: number): { kind: 'crumb' | 'pill' | 'slot'; index: number } {
    if (index === 0) return { kind: 'crumb', index: this.activeIndex() };
    if (index === 1) return { kind: 'slot', index: 0 };
    return { kind: 'pill', index: index - 2 };
  }

  private activeIndex(): number {
    return this.crumbs.findIndex(c => c.active);
  }

  // ── candidates for the open thing ─────────────────────────────────────────

  private candidates(): Candidate[] {
    const open = this.open;
    if (!open) return [];
    const needle = this.text.trim().toLowerCase();
    if (open.kind === 'crumb') {
      const siblings = this.crumbs[open.index]?.siblings ?? [];
      return siblings
        .filter(s => !needle || s.label.toLowerCase().includes(needle) || s.detail.toLowerCase().includes(needle))
        .map(s => ({ label: s.label, detail: s.detail, current: s.current, intent: s.intent }));
    }
    if (open.kind === 'slot') {
      const head = needle.split(/\s+/)[0] ?? '';
      const hasValue = /\s/.test(this.text.trim());
      if (hasValue) {
        // The word is chosen; offer its enumerated values, if any.
        const word = this.words.find(w => needle.startsWith(w.word));
        const value = needle.slice(word?.word.length ?? 0).trim();
        return (word?.values ?? [])
          .filter(v => !value || v.toLowerCase().startsWith(value))
          .map(v => ({ label: `${word!.word} ${v}`, detail: '' }));
      }
      return this.words
        .filter(w => !head || w.word.includes(head))
        .map(w => ({ label: w.word, detail: w.hint, word: w.word }));
    }
    const pill = this.pills[open.index];
    const word = this.words.find(w => w.word === pill?.word);
    return (word?.values ?? [])
      .filter(v => !needle || v.toLowerCase().startsWith(needle))
      .map(v => ({ label: v, detail: '' }));
  }

  // ── keys ──────────────────────────────────────────────────────────────────

  private onKeyDown = (event: KeyboardEvent) => {
    const handled = this.open ? this.editingKey(event) : this.walkingKey(event);
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private walkingKey(event: KeyboardEvent): boolean {
    const { code, key } = event;
    if (code === 'Escape') {
      this.emit('inspector-close', {});
      return true;
    }
    if (code === 'ArrowUp' || code === 'ArrowDown') {
      // Bare and Shift both walk the ladder: there is no pitch to move here,
      // and the gesture people already have keeps working.
      this.emit('inspector-level', { direction: code === 'ArrowUp' ? 'relax' : 'tighten' });
      return true;
    }
    if ((code === 'ArrowLeft' || code === 'ArrowRight') && event.shiftKey) {
      // The score's own range gesture, kept: a range is what the half-tone
      // pills are FOR, so the inspector must be able to make one.
      this.emit('inspector-extend', { direction: code === 'ArrowLeft' ? 'previous' : 'next' });
      return true;
    }
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      // ←→ are the score's own step at this rung — next bar at the bar rung,
      // next note at the note rung — so the window turns sideways the way it
      // turns up and down. Tab walks the frame.
      this.emit('inspector-step', { direction: code === 'ArrowLeft' ? 'previous' : 'next' });
      return true;
    }
    if (code === 'Tab' && event.shiftKey) {
      this.cursor = (this.cursor - 1 + this.itemCount()) % this.itemCount();
      return true;
    }
    if (code === 'Tab') {
      this.cursor = (this.cursor + 1) % this.itemCount();
      return true;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      this.openUnderCursor();
      return true;
    }
    if (code === 'Backspace') {
      const item = this.itemAt(this.cursor);
      if (item.kind !== 'pill') return true;
      const pill = this.pills[item.index];
      if (!pill) return true;
      if (pill.pillClass === 'floor') {
        // Press 1 reverts to the floor; there is no press 2.
        if (pill.remove) this.emit('inspector-remove', { key: pill.key, intent: pill.remove });
      } else if (pill.pillClass === 'annotation') {
        // Press 1 clears the value and leaves the pill open; press 2 (below,
        // in editingKey) removes it.
        this.open = { kind: 'pill', index: item.index, cleared: true };
        this.text = '';
        this.menuIndex = 0;
      }
      return true;
    }
    if (key === '/') {
      this.emit('inspector-widen', { text: '' });
      return true;
    }
    if (key === '?') {
      this.showKeys = !this.showKeys;
      return true;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Bare typing ALWAYS adds: it goes to the blank slot, wherever the
      // cursor was.
      this.open = { kind: 'slot' };
      this.text = key;
      this.menuIndex = 0;
      this.cursor = 1;
      return true;
    }
    return false;
  }

  private openUnderCursor(): void {
    const item = this.itemAt(this.cursor);
    this.menuIndex = 0;
    if (item.kind === 'crumb') {
      const crumb = this.crumbs[item.index];
      if (!crumb?.siblings || crumb.siblings.length === 0) return;
      this.open = { kind: 'crumb', index: item.index };
      this.text = '';
      this.menuIndex = Math.max(0, crumb.siblings.findIndex(s => s.current));
    } else if (item.kind === 'pill') {
      const pill = this.pills[item.index];
      if (!pill || pill.pillClass === 'inherited') return;
      this.open = { kind: 'pill', index: item.index, cleared: false };
      this.text = pill.value;
    } else {
      this.open = { kind: 'slot' };
      this.text = '';
    }
  }

  private editingKey(event: KeyboardEvent): boolean {
    const open = this.open!;
    const { code } = event;
    const list = this.candidates();
    if (event.key === '?') {
      // No grammar takes a `?`, so it is the legend's key in both states.
      this.showKeys = !this.showKeys;
      return true;
    }
    if (code === 'Escape') {
      this.open = null;
      this.text = '';
      return true;
    }
    if (code === 'ArrowUp' || code === 'ArrowDown') {
      if (list.length === 0) return true;
      this.menuIndex = (this.menuIndex + (code === 'ArrowUp' ? -1 : 1) + list.length) % list.length;
      return true;
    }
    if (code === 'Tab' && open.kind === 'slot') {
      const pick = list[this.menuIndex];
      if (pick?.word) this.complete(pick.word);
      else if (pick) this.text = pick.label;
      return true;
    }
    if (code === 'Backspace' && open.kind === 'pill' && this.text === '') {
      // Press 2 on an annotation: the pill goes.
      const pill = this.pills[open.index];
      if (pill?.remove) this.emit('inspector-remove', { key: pill.key, intent: pill.remove });
      this.open = null;
      return true;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      const pick = list[this.menuIndex];
      if (open.kind === 'crumb') {
        if (pick?.intent) this.emit('inspector-goto', { intent: pick.intent });
        this.open = null;
        this.text = '';
        return true;
      }
      if (open.kind === 'slot') {
        const hasValue = /\s/.test(this.text.trim());
        if (!hasValue && pick?.word && pick.word !== this.text.trim()) {
          // Enter on a word without a value completes it, the way Tab does;
          // a second Enter applies (or a bare word like `segno` applies).
          this.complete(pick.word);
          return true;
        }
        const text = hasValue && pick && !pick.word ? pick.label : this.text;
        this.emit('inspector-apply', { word: null, text });
        this.open = null;
        this.text = '';
        return true;
      }
      const pill = this.pills[open.index];
      if (!pill) return true;
      if (this.text.trim() === '' || (pill.pillClass === 'derived' && this.text.trim() === pill.value)) {
        // Empty: press 2 removes. A derived value committed unchanged writes
        // NOTHING — the guess was already right, and freezing it is not a
        // thing this editor does.
        if (pill.remove) this.emit('inspector-remove', { key: pill.key, intent: pill.remove });
      } else {
        this.emit('inspector-apply', { word: pill.word, key: pill.key, text: pick && !pick.word ? pick.label : this.text });
      }
      this.open = null;
      this.text = '';
      return true;
    }
    // Everything else is the input's: typing, ←→ inside the text, ⌫ on text.
    return false;
  }

  /** Complete the slot to a word and leave the caret ready for its value. */
  private complete(word: string): void {
    const wordless = this.words.find(w => w.word === word)?.hint === '';
    this.text = wordless ? word : `${word} `;
    this.menuIndex = 0;
  }

  private onInput = (event: Event) => {
    this.text = (event.target as HTMLInputElement).value;
    this.menuIndex = 0;
  };

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  // ── render ────────────────────────────────────────────────────────────────

  private renderInput() {
    const w = `${Math.max(3, this.text.length + 1)}ch`;
    return html`<input
      .value=${this.text}
      style="width: ${w}"
      @input=${this.onInput}
      spellcheck="false"
      autocomplete="off"
    />`;
  }

  private renderMenu(where: 'rung' | 'slot' | 'pill') {
    const list = this.candidates();
    if (list.length === 0) return nothing;
    return html`<div class="menu for-${where}" role="listbox">
      ${list.map(
        (c, i) => html`<div
          class="row${i === this.menuIndex ? ' cur' : ''}${c.current ? ' current' : ''}"
          role="option"
          aria-selected=${i === this.menuIndex}
          @pointerdown=${(e: Event) => {
            e.preventDefault();
            this.menuIndex = i;
            this.editingKey(new KeyboardEvent('keydown', { code: 'Enter' }));
          }}
        >
          <span class="l">${c.label}</span><span class="m">${c.detail}</span>
        </div>`
      )}
    </div>`;
  }

  /** The rung window: the row above, the current rung, the row below. */
  private renderWindow() {
    const active = this.activeIndex();
    const open = this.open;
    const row = (offset: -1 | 0 | 1) => {
      const crumb = this.crumbs[active + offset];
      const cls = offset < 0 ? 'above' : offset > 0 ? 'below' : 'cur';
      if (!crumb) return html`<div class="rung ${cls} empty">—</div>`;
      const [name, ...rest] = crumb.label.split(' ');
      const idx = rest.join(' ');
      if (offset === 0) {
        const isOpen = open?.kind === 'crumb';
        const cursorHere = !open && this.itemAt(this.cursor).kind === 'crumb';
        return html`<div
          class="rung cur${cursorHere ? ' cursor' : ''}${isOpen ? ' open' : ''}"
          @click=${() => {
            this.open = null;
            this.cursor = 0;
            this.openUnderCursor();
          }}
        >
          <span class="name">${name}</span>
          ${isOpen ? this.renderInput() : html`<span class="idx">${idx}</span>`}
        </div>`;
      }
      return html`<div
        class="rung ${cls}"
        @click=${() => this.emit('inspector-level', { direction: offset < 0 ? 'relax' : 'tighten' })}
      >
        <span class="name">${name}</span><span class="idx">${idx}</span>
      </div>`;
    };
    return html`<div class="window">${row(-1)}${row(0)}${row(1)}</div>`;
  }

  private keyLegend() {
    const open = this.open;
    const rows: [string, string][] = !open
      ? [
          ['↑↓', 'ladder'],
          ['←→', 'step'],
          ['⇧←→', 'extend'],
          ['Tab', 'walk'],
          ['Enter', 'open'],
          ['type', 'add'],
          ['⌫', 'clear · remove'],
          ['/', 'tray'],
          ['Esc', 'close']
        ]
      : open.kind === 'crumb'
        ? [
            ['type', 'filter'],
            ['↑↓', 'siblings'],
            ['Enter', 'go to'],
            ['Esc', 'back']
          ]
        : open.kind === 'slot'
          ? [
              ['type', 'filter'],
              ['↑↓', 'choose'],
              ['Tab', 'complete → value'],
              ['Enter', 'apply'],
              ['Esc', 'clear']
            ]
          : [
              ['type', 'replace'],
              ['↑↓', 'cycle'],
              ['Enter', 'commit'],
              ['⌫ on empty', 'remove'],
              ['Esc', 'back']
            ];
    return html`<div class="keys">${rows.map(([k, m]) => html`<span><b>${k}</b> ${m}</span>`)}</div>`;
  }

  render() {
    const open = this.open;
    const stateLabel = !open
      ? 'walking'
      : open.kind === 'crumb'
        ? 'go to'
        : open.kind === 'slot'
          ? 'add'
          : open.cleared
            ? 'cleared'
            : 'amend';
    const cursorAt = (kind: 'crumb' | 'pill' | 'slot', index: number) => {
      const item = this.itemAt(this.cursor);
      return !open && item.kind === kind && item.index === index;
    };
    return html`
      <div class="shaft"></div>
      <div class="box" role="dialog" aria-label="rung inspector">
        <div class="body">
          ${this.renderWindow()}
          <div class="attrs">
            <div class="slotrow">
              ${this.words.length > 0
                ? html`<span
                    class="slot${cursorAt('slot', 0) ? ' cursor' : ''}${open?.kind === 'slot' ? ' open' : ''}"
                    @click=${() => {
                      this.open = { kind: 'slot' };
                      this.text = '';
                      this.cursor = 1;
                    }}
                    >${open?.kind === 'slot' ? this.renderInput() : 'add…'}</span
                  >`
                : html`<span class="note" style="padding: 0">${this.note ?? ''}</span>`}
          <span class="state${open ? ' editing' : ''}">${stateLabel}</span>
          <span class="secondary">${this.secondary}</span>
          <button
            class="help${this.showKeys ? ' on' : ''}"
            title="keys (?)"
            tabindex="-1"
            @pointerdown=${(e: Event) => {
              e.preventDefault();
              this.showKeys = !this.showKeys;
            }}
          >?</button>
            </div>
            <div class="pills">
              ${this.pills.map((pill, i) => {
                const isOpen = open?.kind === 'pill' && open.index === i;
                const tail =
                  pill.pillClass === 'floor'
                    ? FLOOR_GLYPH
                    : pill.pillClass === 'annotation'
                      ? X_GLYPH
                      : nothing;
                return html`<span
                  class="pill ${pill.pillClass}${pill.partial ? ' half' : ''}${cursorAt('pill', i) ? ' cursor' : ''}${isOpen ? ' open' : ''}"
                  @click=${() => {
                    this.open = null;
                    this.cursor = 2 + i;
                    this.openUnderCursor();
                  }}
                  ><span class="k">${pill.word}:</span>${isOpen ? this.renderInput() : pill.value}${isOpen
                    ? nothing
                    : tail}</span
                >`;
              })}
            </div>
            ${this.overflow > 0 ? html`<span class="more">+${this.overflow} more · scrolls</span>` : nothing}
          </div>
          ${open?.kind === 'crumb' ? this.renderMenu('rung') : nothing}
          ${open?.kind === 'slot' ? this.renderMenu('slot') : nothing}
          ${open?.kind === 'pill' ? this.renderMenu('pill') : nothing}
        </div>
        ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
        ${this.note && this.words.length > 0 ? html`<div class="note">${this.note}</div>` : nothing}
        ${this.showKeys ? this.keyLegend() : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-rung-inspector': RungInspector;
  }
}
