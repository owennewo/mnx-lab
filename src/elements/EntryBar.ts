/**
 * The entry bar (roadmap/proposed/studio-editor-touch.md): the editor's verbs
 * as targets you can hit with a thumb, for a tablet that has no keyboard.
 *
 * It lives **inside the editor's own surfaces layer, over the score**, and not
 * in the shell's chrome — the owner's tablet edits in focus mode, which is
 * browser fullscreen, and the tools row is not rendered there. A palette you
 * cannot reach in fullscreen is a palette for a different device.
 *
 * NEUTRAL, like the rung inspector beside it: it renders what the binding hands
 * it and emits the intent the user asked for. It never touches a document, so
 * it can be judged on its buttons alone. Every control refuses focus on the
 * press — `hasKeyboard()` is "focus is inside the viewer or the surfaces", and
 * a button that took focus would dim the cursor it is about to move.
 *
 * Tokens are INHERITED, never declared: `<mnx-editor-surfaces>` is the ancestor
 * that declares them, and a `designTokens` block here would pin the bar light
 * (harness/conformance/design-tokens.test.ts holds every surface to that).
 */
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { MAX_ENTRY_FRET, type EditorIntent } from '../edit/intents.ts';
import type { MnxNoteValueBase } from '../model/mnx.ts';

/** The durations a first pass offers, shortest last — the ones a guitarist
 *  actually types. The ladder verbs still exist on the keyboard. */
const DURATIONS: readonly { base: MnxNoteValueBase; label: string; title: string }[] = [
  { base: 'whole', label: '𝅝', title: 'Whole' },
  { base: 'half', label: '𝅗𝅥', title: 'Half' },
  { base: 'quarter', label: '𝅘𝅥', title: 'Quarter' },
  { base: 'eighth', label: '𝅘𝅥𝅮', title: 'Eighth' },
  { base: '16th', label: '𝅘𝅥𝅯', title: 'Sixteenth' }
];

/** How many frets the pad shows at once; the shift reaches the rest. */
const PAD_FRETS = 12;

@customElement('mnx-entry-bar')
export class EntryBar extends LitElement {
  /** Which space the cursor is in: frets on the fingerboard, notes on a staff. */
  @property() projection: 'notation' | 'tab' = 'tab';
  @property({ type: Boolean }) canUndo = false;
  @property({ type: Boolean }) canRedo = false;
  /** A half-typed fret from the keyboard, so the two entry paths agree. */
  @property({ type: Number }) pendingFret: number | null = null;

  /** The upper half of the fingerboard, reached by the shift rather than by a
   *  second row — 25 buttons at thumb size do not fit a tablet's width. */
  private shifted = false;

  static styles = css`
    :host {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: block;
      padding: 6px;
      box-sizing: border-box;
      background: color-mix(in oklab, var(--paper) 88%, transparent);
      backdrop-filter: blur(6px);
      border-top: 1px solid var(--line);
      /* Under the inspector, which is the surface that answers questions. */
      z-index: 1;
    }
    .row {
      display: flex;
      gap: 4px;
      align-items: stretch;
    }
    .row + .row {
      margin-top: 4px;
    }
    button {
      flex: 1 1 0;
      min-width: 0;
      /* 44px is the platform's smallest comfortable touch target, and the
         reason this bar is a bar rather than a denser palette. */
      min-height: 44px;
      font: inherit;
      font-size: 15px;
      color: var(--paper-ink);
      background: var(--paper);
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      cursor: pointer;
      touch-action: manipulation;
      user-select: none;
    }
    button:active {
      background: color-mix(in oklab, var(--accent) 22%, var(--paper));
    }
    button[aria-pressed='true'] {
      background: var(--accent);
      color: var(--accent-fg);
      border-color: var(--accent);
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .verbs button,
    .shift {
      flex: 0 0 auto;
      padding: 0 12px;
    }
    .glyph {
      font-size: 19px;
      line-height: 1;
    }
  `;

  /** Every press: never take focus, never let the score see it as a placement. */
  private readonly hold = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  private fire(intent: EditorIntent) {
    this.dispatchEvent(
      new CustomEvent<{ intent: EditorIntent }>('entry-action', {
        detail: { intent },
        bubbles: true,
        composed: true
      })
    );
  }

  private button(
    label: unknown,
    title: string,
    onPress: () => void,
    options: { pressed?: boolean; disabled?: boolean; cls?: string } = {}
  ) {
    return html`<button
      class=${options.cls ?? ''}
      title=${title}
      aria-label=${title}
      ?disabled=${options.disabled ?? false}
      aria-pressed=${options.pressed === undefined ? nothing : String(options.pressed)}
      @pointerdown=${this.hold}
      @click=${onPress}
    >${label}</button>`;
  }

  /** The fingerboard: 0…12, shifted to 12…24. A fret is one tap — the
   *  keyboard's two-digit window is a keystroke device, and a pad has room to
   *  simply show the number. */
  private frets() {
    const base = this.shifted ? PAD_FRETS : 0;
    const frets = Array.from({ length: PAD_FRETS + 1 }, (_, i) => base + i).filter(
      fret => fret <= MAX_ENTRY_FRET
    );
    return html`<div class="row">
      ${frets.map(fret =>
        this.button(String(fret), `Fret ${fret}`, () => this.fire({ type: 'enterFret', fret }), {
          pressed: this.pendingFret === fret
        })
      )}
      ${this.button(
        this.shifted ? '−12' : '+12',
        this.shifted ? 'Frets 0 to 12' : 'Frets 12 to 24',
        () => {
          this.shifted = !this.shifted;
          this.requestUpdate();
        },
        { cls: 'shift', pressed: this.shifted }
      )}
    </div>`;
  }

  /** The staff: there is no "type a pitch" verb — a note is toggled at the
   *  cursor's cell and then nudged, which is exactly what the keyboard does. */
  private notes() {
    return html`<div class="row">
      ${this.button('Note', 'Add or remove a note here', () => this.fire({ type: 'toggleNote' }))}
      ${this.button('♯', 'Up a semitone', () => this.fire({ type: 'transpose', semitones: 1 }))}
      ${this.button('♭', 'Down a semitone', () => this.fire({ type: 'transpose', semitones: -1 }))}
      ${this.button('8va', 'Up an octave', () => this.fire({ type: 'transpose', semitones: 12 }))}
      ${this.button('8vb', 'Down an octave', () => this.fire({ type: 'transpose', semitones: -12 }))}
    </div>`;
  }

  render() {
    return html`
      ${this.projection === 'tab' ? this.frets() : this.notes()}
      <div class="row verbs">
        ${DURATIONS.map(duration =>
          this.button(
            html`<span class="glyph">${duration.label}</span>`,
            duration.title,
            () => this.fire({ type: 'setEventDuration', base: duration.base })
          )
        )}
        ${this.button('·', 'Dotted', () => this.fire({ type: 'toggleDots' }))}
        ${this.button('⌒', 'Tie', () => this.fire({ type: 'toggleTie' }))}
        ${this.button('⌫', 'Delete', () => this.fire({ type: 'delete' }))}
        ${this.button('↶', 'Undo', () => this.fire({ type: 'undo' }), { disabled: !this.canUndo })}
        ${this.button('↷', 'Redo', () => this.fire({ type: 'redo' }), { disabled: !this.canRedo })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-entry-bar': EntryBar;
  }
}
