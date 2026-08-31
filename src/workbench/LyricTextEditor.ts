// The lyric text editor — the paste-and-tweak surface of one-surface item 6
// phase 2 (roadmap/complete/workbench-one-surface-lyrics.md). The buffer is
// WORKBENCH STATE, not the document: it opens on the canonical projection
// (serializeLyricText), parses live into bar-anchored diagnostics, and Apply
// hands the host a computed plan (planLyricEdits) to fire as ONE intent —
// nothing here writes the document.
//
// A bottom DRAWER, not a centered modal: the score stays visible above and
// the host renders the buffer's parse onto it live (lyric-editor-edits →
// a scratch document through the same lyricPlanOps the session applies), so
// typing reads as writing under the staff. Keyboard ownership needs no
// precedence wiring — a focused textarea is isTextEntry and the page keymap
// yields; clicking the score hands the keys back without closing the drawer.
// The caret→score cross-highlight rides the selection context's preview
// channel via the lyric-editor-preview event.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
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
  'split - · hold fant--as · extend day__ · skip _ · join you~are · bars | 6| · header nl 2: · Ctrl+Enter applies';

@customElement('mnx-lyric-text-editor')
export class LyricTextEditor extends LitElement {
  @property({ attribute: false }) doc: MnxStructure | null = null;
  @property({ type: Number }) partIndex = 0;
  /** The part's display name, for the header. */
  @property({ type: String }) partLabel = '';
  /** Opens with the caret on this note's token, when it has one. */
  @property({ type: String }) focusNoteKey = '';

  @state() private text = '';
  @state() private parsed: ParsedLyricText = { lines: [], diagnostics: [], tokens: [] };
  /** The pass bound (phase 3): blue, live, never blocks apply. */
  @state() private warnings: LyricTextDiagnostic[] = [];
  @state() private edits: LyricPlanEdit[] = [];

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 40;
      }
      .card {
        position: relative;
        margin: 0 auto;
        width: min(960px, 100vw);
        max-height: 44vh;
        background: var(--surface);
        border: 1px solid var(--line-strong);
        border-bottom: none;
        border-radius: var(--radius-card) var(--radius-card) 0 0;
        box-shadow: var(--shadow);
        overflow: hidden;
        outline: none;
        display: flex;
        flex-direction: column;
      }
      header {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 10px 14px 8px;
        border-bottom: 1px solid var(--line);
      }
      header .title {
        font-weight: 600;
      }
      header .part {
        color: var(--ink-3);
        font-size: 12px;
      }
      textarea {
        margin: 10px 14px 6px;
        min-height: 5em;
        resize: vertical;
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
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
      }
      .legend {
        flex: 1;
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
      button.apply {
        font-weight: 600;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `
  ];

  firstUpdated() {
    if (this.doc) {
      this.text = serializeLyricText(this.doc, this.partIndex);
      this.reparse();
    }
    const area = this.textarea();
    if (!area) return;
    area.focus();
    // Open at the caller's note: place the caret on its token.
    if (this.focusNoteKey && this.doc) {
      const walk = lyricEventWalk(this.doc, this.partIndex);
      const entryIndex = walk.findIndex(entry => entry.noteKey === this.focusNoteKey);
      const span = this.parsed.tokens.find(token => token.entryIndex === entryIndex);
      if (span) {
        area.setSelectionRange(span.from, span.to);
        this.previewAt(span.from);
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
    // The live preview: a clean parse hands the host the current diff so the
    // score above redraws as if applied. While errors stand, the last clean
    // preview holds — flickering back to the committed text mid-word would
    // punish typing the very hyphen the parser is complaining about.
    if (this.parsed.diagnostics.length === 0) {
      this.dispatchEvent(new CustomEvent('lyric-editor-edits', {
        detail: { edits: this.edits },
        bubbles: true,
        composed: true
      }));
    }
  }

  /** Caret → walk entry → the note to light, over the preview channel. */
  private previewAt(caret: number) {
    if (!this.doc) return;
    const span = this.parsed.tokens.find(token => caret >= token.from && caret <= token.to);
    const walk = span ? lyricEventWalk(this.doc, this.partIndex) : [];
    const noteKey = span ? walk[span.entryIndex]?.noteKey : undefined;
    this.dispatchEvent(new CustomEvent('lyric-editor-preview', {
      detail: { noteKeys: noteKey ? [noteKey] : [] },
      bubbles: true,
      composed: true
    }));
  }

  private onInput = () => {
    const area = this.textarea();
    if (!area) return;
    this.text = area.value;
    this.reparse();
    this.previewAt(area.selectionStart);
  };

  private onCaretMove = () => {
    const area = this.textarea();
    if (area) this.previewAt(area.selectionStart);
  };

  private close() {
    this.dispatchEvent(new CustomEvent('lyric-editor-close', { bubbles: true, composed: true }));
  }

  private apply() {
    if (this.parsed.diagnostics.length > 0 || this.edits.length === 0) return;
    this.dispatchEvent(new CustomEvent('lyric-editor-apply', {
      detail: { edits: this.edits },
      bubbles: true,
      composed: true
    }));
  }

  private onKey = (event: KeyboardEvent) => {
    // The drawer owns its keystrokes: nothing it sees may reach the page
    // keymap. (The reverse door stays open — clicking the score moves focus
    // out and the score keys work with the drawer still up.)
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.apply();
    }
  };

  render() {
    const blocked = this.parsed.diagnostics.length > 0;
    const shown = [...this.parsed.diagnostics, ...this.warnings];
    return html`
      <div class="card" tabindex="-1" @keydown=${this.onKey}>
        <header>
          <span class="title">lyrics</span>
          ${this.partLabel ? html`<span class="part">${this.partLabel}</span>` : nothing}
        </header>
        <textarea
          spellcheck="false"
          .value=${this.text}
          @input=${this.onInput}
          @keyup=${this.onCaretMove}
          @click=${this.onCaretMove}
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
          <button @click=${() => this.close()}>close</button>
          <button
            class="apply"
            ?disabled=${blocked || this.edits.length === 0}
            title=${blocked ? 'fix the diagnostics first' : this.edits.length === 0 ? 'no changes' : 'apply as one edit'}
            @click=${() => this.apply()}
          >apply</button>
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
