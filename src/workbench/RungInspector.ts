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
 *   walking — ↑↓ the ladder · ←→/Tab walk pills · Enter opens · typing goes
 *             to the blank slot · ⌫ clears then removes · `/` widens · Esc closes
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
  @property({ type: String }) primary = '';
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

    .meta .state {
      margin-left: auto;
      font: 600 8.5px/1.2 var(--sans);
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--ink-3);
      flex: none;
    }

    .meta .state.editing {
      color: var(--accent-fg);
    }

    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px 3px;
      padding: 8px 9px;
    }

    .line.attrs {
      gap: 5px;
      margin: 0 9px;
      padding: 7px 0 8px;
      border-top: 1px dashed var(--line);
    }

    .sep {
      color: var(--ink-faint);
      font: 500 11px var(--mono);
      padding: 0 1px;
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

    .pill.crumb {
      color: var(--ink-2);
    }

    .pill.crumb.active {
      border-color: var(--accent);
      color: var(--ink);
    }

    .pill.inherited {
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
      min-width: 96px;
      padding: 4px 6px;
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
      margin: 0 9px 8px;
      width: max-content;
      max-width: calc(100% - 18px);
      min-width: 170px;
      border: 1px solid var(--line-strong);
      background: var(--surface);
      display: flex;
      flex-direction: column;
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
      padding: 6px 9px;
      border-top: 1px solid var(--line);
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
    // The cursor starts on the ACTIVE crumb — the rung you are on — so ↑↓
    // reads as "move from here" and Enter opens where you already are.
    const active = this.crumbs.findIndex(c => c.active);
    this.cursor = active >= 0 ? active : 0;
    this.focus();
  }

  /** The active crumb's index at the last render, so a change in it — the
   *  ladder moved — can be told from a re-render that moved nothing. */
  private lastActive = -1;

  updated(changed: Map<string | number | symbol, unknown>) {
    if (changed.has('crumbs') || changed.has('pills')) {
      const active = this.crumbs.findIndex(c => c.active);
      const onCrumb = this.cursor < this.crumbs.length;
      // The ladder moved (↑↓, go to): a cursor that was on a crumb follows
      // the rung, so the next Enter opens where you now are. A cursor on a
      // pill stays put — the pills are what you were looking at.
      if (active >= 0 && active !== this.lastActive && onCrumb) this.cursor = active;
      this.lastActive = active;
      this.cursor = Math.min(this.cursor, this.itemCount() - 1);
    }
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

  // ── the item row: crumbs, pills, slot ────────────────────────────────────

  private itemCount(): number {
    return this.crumbs.length + this.pills.length + 1;
  }

  private itemAt(index: number): { kind: 'crumb' | 'pill' | 'slot'; index: number } {
    if (index < this.crumbs.length) return { kind: 'crumb', index };
    if (index < this.crumbs.length + this.pills.length)
      return { kind: 'pill', index: index - this.crumbs.length };
    return { kind: 'slot', index: 0 };
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
    if (code === 'ArrowLeft' || (code === 'Tab' && event.shiftKey)) {
      this.cursor = (this.cursor - 1 + this.itemCount()) % this.itemCount();
      return true;
    }
    if (code === 'ArrowRight' || code === 'Tab') {
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
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Bare typing ALWAYS adds: it goes to the blank slot, wherever the
      // cursor was.
      this.open = { kind: 'slot' };
      this.text = key;
      this.menuIndex = 0;
      this.cursor = this.itemCount() - 1;
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
      if (this.text.trim() === '') {
        if (pill.remove) this.emit('inspector-remove', { key: pill.key, intent: pill.remove });
      } else {
        this.emit('inspector-apply', { word: pill.word, text: pick && !pick.word ? pick.label : this.text });
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

  private renderMenu() {
    const list = this.candidates();
    if (list.length === 0) return nothing;
    return html`<div class="menu" role="listbox">
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

  private keyLegend() {
    const open = this.open;
    const rows: [string, string][] = !open
      ? [
          ['↑↓', 'ladder'],
          ['←→ Tab', 'walk'],
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
        <div class="meta">
          <span class="primary">${this.primary}</span>
          <span class="secondary">${this.secondary}</span>
          <span class="state${open ? ' editing' : ''}">${stateLabel}</span>
        </div>
        <div class="line">
          ${this.crumbs.map((crumb, i) => {
            const isOpen = open?.kind === 'crumb' && open.index === i;
            return html`${i > 0 ? html`<span class="sep">›</span>` : nothing}<span
                class="pill crumb${crumb.active ? ' active' : ''}${cursorAt('crumb', i) ? ' cursor' : ''}${isOpen ? ' open' : ''}"
                @click=${() => {
                  this.open = null;
                  this.cursor = i;
                  this.openUnderCursor();
                }}
              >${isOpen
                  ? html`<span class="k">${crumb.key}:</span>${this.renderInput()}`
                  : crumb.label}</span
              >`;
          })}
        </div>
        ${open?.kind === 'crumb' ? this.renderMenu() : nothing}
        ${this.note
          ? html`<div class="note">${this.note}</div>`
          : html`<div class="line attrs">
              ${this.pills.map((pill, i) => {
                const isOpen = open?.kind === 'pill' && open.index === i;
                const tail =
                  pill.pillClass === 'floor'
                    ? FLOOR_GLYPH
                    : pill.pillClass === 'annotation'
                      ? X_GLYPH
                      : nothing;
                return html`<span
                  class="pill ${pill.pillClass}${cursorAt('pill', i) ? ' cursor' : ''}${isOpen ? ' open' : ''}"
                  @click=${() => {
                    this.open = null;
                    this.cursor = this.crumbs.length + i;
                    this.openUnderCursor();
                  }}
                  ><span class="k">${pill.word}:</span>${isOpen ? this.renderInput() : pill.value}${isOpen
                    ? nothing
                    : tail}</span
                >`;
              })}
              ${this.words.length > 0
                ? html`<span
                    class="slot${cursorAt('slot', 0) ? ' cursor' : ''}${open?.kind === 'slot' ? ' open' : ''}"
                    @click=${() => {
                      this.open = { kind: 'slot' };
                      this.text = '';
                      this.cursor = this.itemCount() - 1;
                    }}
                    >${open?.kind === 'slot' ? this.renderInput() : 'add…'}</span
                  >`
                : nothing}
            </div>`}
        ${open && open.kind !== 'crumb' ? this.renderMenu() : nothing}
        ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
        ${this.keyLegend()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-rung-inspector': RungInspector;
  }
}
