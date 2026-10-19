// The lyric text editor — the paste-and-tweak surface of one-surface item 6
// phase 2 (roadmap/complete/workbench-one-surface-lyrics.md). The buffer is
// WORKBENCH STATE, not the document: it opens on the canonical projection
// (serializeLyricText) and parses live into bar-anchored diagnostics. There is
// no apply: a pause in typing, leaving the box, closing the panel or hiding the
// page COMMITS a clean parse — the host is handed the plan (planLyricEdits)
// against `doc`, the document the visit opened on, and keeps one undo step per
// visit. Text that does not parse cannot be committed, so it goes to the host's
// draft store instead and is offered back the next time the panel opens.
//
// A right-hand panel: the score frame makes room beside the score and
// the host renders the buffer's parse onto it live (lyric-editor-edits →
// a scratch document through the same lyricPlanOps the session applies), so
// typing previews the words on the score once it pauses (LYRIC_PREVIEW_PAUSE_MS).
// Keyboard ownership needs no precedence wiring — a focused textarea is isTextEntry and the page keymap
// yields; clicking the score hands the keys back without closing the drawer.
// The caret IS the editor's cursor: a caret on a word sends its visit and
// onset (lyric-editor-caret) and the host moves the one cursor there — the
// playback cursor with it. The panel draws no cursor of its own. A click or
// an arrow moves it at once; typing moves it at the pause, with the preview.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome, scrollbars } from './tokens.ts';
import type { MnxStructure } from '../model/mnx.ts';
import {
  lyricEventWalk,
  lyricPassWarnings,
  parseLyricText,
  planLyricEdits,
  serializeLyricText,
  type LyricPlanEdit,
  type LyricTextDiagnostic,
  type ParsedLyricText
} from '../edit/lyricText.ts';

const LEGEND =
  'split - · hold fant--as · extend day__ · skip _ · join you~are · bars 9.1| (bar.visit), | next · optional nl 2:';

/** How long typing must pause before a clean parse is committed. */
export const LYRIC_COMMIT_PAUSE_MS = 3_000;
/** …and before the score beside it is redrawn as the text reads: a redraw of a long
 *  piece costs more than a keystroke is worth, so the box answers at once and the
 *  score catches up when the typing stops. */
export const LYRIC_PREVIEW_PAUSE_MS = 250;

/** What the host is told: `edits` to commit; `accepted` is set by the host when they landed. */
export interface LyricCommitDetail { edits: LyricPlanEdit[]; accepted: boolean }

@customElement('mnx-lyric-text-editor')
export class LyricTextEditor extends LitElement {
  @property({ attribute: false }) doc: MnxStructure | null = null;
  @property({ type: Number }) partIndex = 0;
  /** The part's display name, for the header. */
  @property({ type: String }) partLabel = '';
  /** Opens with the caret on this note's token, when it has one. */
  @property({ type: String }) focusNoteKey = '';
  /** …on this performed visit of it, when the text names that visit. */
  @property({ type: Number }) focusOrdinal: number | null = null;
  /** The music is playing: the panel stays open, read-only, until it pauses — nothing is written while it plays. */
  @property({ type: Boolean }) playing = false;
  /** Text a previous visit could not commit, offered in place of the document's own. */
  @property({ attribute: false }) draft: string | null = null;

  @state() private text = '';
  @state() private parsed: ParsedLyricText = { lines: [], diagnostics: [], tokens: [] };
  /** The pass bound (phase 3): blue, live, never blocks a commit. */
  @state() private warnings: LyricTextDiagnostic[] = [];
  @state() private edits: LyricPlanEdit[] = [];
  /** The box holds text the document has not been given yet. */
  @state() private pending = false;
  /** The text was typed in during this visit (or brought back from a draft). */
  private touched = false;
  private commitTimer: ReturnType<typeof setTimeout> | undefined;
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  /** The key down now typed (an input followed it), rather than only moving the caret. */
  private typed = false;

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(480px, 100vw);
        z-index: 40;
        display: flex;
        min-height: 0;
      }
      :host([slot='side']) {
        position: relative;
        inset: auto;
        width: min(480px, 45vw);
        max-width: 100%;
        height: 100%;
        z-index: auto;
      }
      .card {
        position: relative;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        min-height: 0;
        background: var(--surface);
        border-left: 1px solid var(--frame-line, var(--line));
        overflow: hidden;
        outline: none;
        display: flex;
        flex-direction: column;
      }
      header {
        display: flex;
        align-items: center;
        flex: none;
        min-height: 40px;
        gap: 8px;
        padding: 0 8px 0 16px;
        border-bottom: 1px solid var(--line);
      }
      header .title {
        font-weight: 600;
      }
      header .part {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--ink-3);
        font-size: 12px;
      }
      textarea {
        margin: 10px 14px 6px;
        flex: 1;
        min-height: 5em;
        min-width: 0;
        resize: none;
        font: 13px/1.7 var(--mono);
        color: var(--ink);
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 8px 10px;
        outline: none;
      }
      textarea:focus {
        border-color: var(--line-strong);
      }
      .diagnostics {
        margin: 0 14px;
        max-height: 25%;
        overflow: auto;
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .diagnostic {
        font-size: 12px;
        color: var(--accent);
      }
      /* The blue lane (decision A): worth naming, never worth refusing over.
         No blue token exists in the shared palette yet, so the pair is local
         — matched to the renderer's warning-badge hue. */
      .diagnostic.warning {
        color: light-dark(oklch(0.45 0.13 250), oklch(0.72 0.11 250));
      }
      footer {
        display: flex;
        flex: none;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-top: 1px solid var(--line);
      }
      .legend {
        flex: 1 0 100%;
        font-size: 11px;
        color: var(--ink-3);
      }
      button {
        font: inherit;
        padding: 4px 14px;
        border-radius: 6px;
        border: 1px solid var(--line-strong);
        background: var(--surface);
        color: var(--ink);
        cursor: pointer;
      }
      button.close {
        margin-left: auto;
        flex: none;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--ink-3);
        font-size: 20px;
      }
      button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
      .status {
        margin-right: auto;
        font-size: 12px;
        color: var(--ink-3);
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    globalThis.document?.addEventListener('visibilitychange', this.onHidden);
    globalThis.addEventListener?.('pagehide', this.onHidden);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.commitTimer);
    clearTimeout(this.previewTimer);
    globalThis.document?.removeEventListener('visibilitychange', this.onHidden);
    globalThis.removeEventListener?.('pagehide', this.onHidden);
  }

  firstUpdated() {
    if (this.doc) {
      this.text = serializeLyricText(this.doc, this.partIndex);
      if (this.draft !== null && this.draft !== this.text) {
        this.text = this.draft;
        this.touched = this.pending = true;
      }
      this.reparse();
      if (this.pending) this.preview();
    }
    const area = this.textarea();
    if (!area) return;
    area.focus();
    // Open at the caller's note: place the caret on its token.
    if (this.focusNoteKey && this.doc) {
      const walk = lyricEventWalk(this.doc, this.partIndex);
      const entryIndex = walk.findIndex(entry => entry.noteKey === this.focusNoteKey);
      const tokens = this.parsed.tokens.filter(token => token.entryIndex === entryIndex);
      const span = tokens.find(token => token.ordinal === this.focusOrdinal) ?? tokens[0];
      if (span) {
        // The cursor is already there, so nothing is sent until the caret moves.
        area.setSelectionRange(span.from, span.to);
      }
    }
  }

  private textarea(): HTMLTextAreaElement | null {
    return this.renderRoot.querySelector('textarea');
  }

  private reparse() {
    if (!this.doc) return;
    this.parsed = parseLyricText(this.doc, this.partIndex, this.text);
    this.warnings = lyricPassWarnings(this.doc, this.partIndex, this.parsed);
    this.edits = this.parsed.diagnostics.length === 0
      ? planLyricEdits(this.doc, this.partIndex, this.parsed)
      : [];
  }

  /**
   * The live preview: a clean parse hands the host the current diff so the
   * score beside it redraws as if applied. While errors stand, the last clean
   * preview holds — flickering back to the committed text mid-word would
   * punish typing the very hyphen the parser is complaining about.
   */
  private preview() {
    clearTimeout(this.previewTimer); this.previewTimer = undefined;
    if (this.parsed.diagnostics.length === 0) {
      this.dispatchEvent(new CustomEvent('lyric-editor-edits', {
        detail: { edits: this.edits },
        bubbles: true,
        composed: true
      }));
    }
  }

  /** Caret → the word's performed place → the host moves the editor's cursor there. */
  private caretAt(caret: number) {
    const span = this.parsed.tokens.find(token => caret >= token.from && caret <= token.to);
    // Sent on every caret move, the same word too: the cursor may have moved off it meanwhile, and a
    // place the cursor already holds settles without seeking.
    if (span?.ordinal === undefined || !span.onset) return;
    this.dispatchEvent(new CustomEvent('lyric-editor-caret', {
      detail: { ordinal: span.ordinal, onset: span.onset },
      bubbles: true,
      composed: true
    }));
  }

  private onInput = () => {
    const area = this.textarea();
    if (!area) return;
    this.text = area.value;
    this.touched = this.pending = true;
    this.reparse();
    // The cursor follows the typing at the pause, with the preview — in the same
    // frame, so the score is laid out once, not on every word the caret enters.
    this.typed = true;
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => this.settleTyping(), LYRIC_PREVIEW_PAUSE_MS);
    clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => this.commit(), LYRIC_COMMIT_PAUSE_MS);
  };

  /**
   * Give the document what the box holds, now. A clean parse is handed to the
   * host as the plan against `doc`; text that does not parse — or that the host
   * turned away — is kept as a draft instead. Nothing is sent while playing.
   */
  commit() {
    clearTimeout(this.commitTimer); this.commitTimer = undefined;
    // A commit redraws the score itself; the preview it would have drawn is moot — but not
    // the cursor move that was waiting with it.
    if (this.previewTimer !== undefined) {
      clearTimeout(this.previewTimer); this.previewTimer = undefined;
      const area = this.textarea();
      if (area) this.caretAt(area.selectionStart);
    }
    if (!this.pending || this.playing || !this.doc) return;
    this.reparse();
    if (this.parsed.diagnostics.length === 0) {
      const detail: LyricCommitDetail = { edits: this.edits, accepted: false };
      this.dispatchEvent(new CustomEvent('lyric-editor-commit', { detail, bubbles: true, composed: true }));
      if (detail.accepted) {
        this.pending = false;
        this.saveDraft(null);
        return;
      }
    }
    this.saveDraft(this.text);
  }

  /** The document the plan is measured against moved under the visit: plan against the new one. */
  rebase(doc: MnxStructure) {
    this.doc = doc;
    this.reparse();
  }

  /** The plan against `doc`, or null while the text does not parse. */
  get plan(): LyricPlanEdit[] | null {
    return this.parsed.diagnostics.length === 0 ? this.edits : null;
  }

  private saveDraft(text: string | null) {
    this.dispatchEvent(new CustomEvent('lyric-editor-draft', { detail: { text }, bubbles: true, composed: true }));
  }

  /** Leaving the page: commit what can be, and keep this visit's text as a draft too — the
   *  commit's own recovery write may not get out before the page does. A draft the document
   *  already holds plans to nothing when it is next opened, and is dropped then. */
  private onHidden = (event: Event) => {
    if (event.type === 'visibilitychange' && globalThis.document?.visibilityState !== 'hidden') return;
    this.commit();
    if (this.touched) this.saveDraft(this.text);
  };

  private onBlur = () => this.commit();

  /** The pause after typing: the cursor goes to the caret's word, and the score previews the text. */
  private settleTyping() {
    const area = this.textarea();
    if (area) this.caretAt(area.selectionStart);
    this.preview();
  }

  /** A key that typed waits for the pause; one that only moved the caret moves the cursor now. */
  private onCaretMove = (event: Event) => {
    if (event.type === 'keyup' && this.typed) return;
    const area = this.textarea();
    if (area) this.caretAt(area.selectionStart);
  };

  private close() {
    this.commit();
    this.dispatchEvent(new CustomEvent('lyric-editor-close', { bubbles: true, composed: true }));
  }

  private onKey = (event: KeyboardEvent) => {
    // The drawer owns its keystrokes: nothing it sees may reach the page
    // keymap. (The reverse door stays open — clicking the score moves focus
    // out and the score keys work with the drawer still up.)
    event.stopPropagation();
    this.typed = false;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  };

  render() {
    const blocked = this.parsed.diagnostics.length > 0;
    const shown = [...this.parsed.diagnostics, ...this.warnings];
    return html`
      <div class="card" role="complementary" aria-label="Lyrics" tabindex="-1" @keydown=${this.onKey}>
        <header>
          <span class="title">lyrics</span>
          ${this.partLabel ? html`<span class="part">${this.partLabel}</span>` : nothing}
          <button class="close" aria-label="Close lyrics" title="Close lyrics (Escape)" @click=${() => this.close()}>×</button>
        </header>
        <textarea
          aria-label="Lyric text"
          ?readonly=${this.playing}
          title=${this.playing ? 'pause to edit' : ''}
          spellcheck="false"
          .value=${this.text}
          @input=${this.onInput}
          @keyup=${this.onCaretMove}
          @click=${this.onCaretMove}
          @blur=${this.onBlur}
        ></textarea>
        <div class="diagnostics">
          ${shown.map(d => html`
            <span class="diagnostic${d.severity === 'warning' ? ' warning' : ''}">
              ${d.bar !== undefined ? `bar ${d.bar} — ` : `line ${d.textLine + 1} — `}${d.message}
            </span>
          `)}
        </div>
        <footer>
          <span class="legend">${LEGEND}</span>
          <span class="status" role="status">${this.pending && blocked ? 'not in the score yet — fix the errors above' : ''}</span>
          <button @click=${() => this.close()}>close</button>
        </footer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-lyric-text-editor': LyricTextEditor;
  }
}
