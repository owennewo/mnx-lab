import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  mnxDocumentContext,
  playbackStateContext,
  selectionContext
} from '../contexts/mnxContext.ts';
import type { PlaybackState, SelectionContext } from '../contexts/mnxContext.ts';
import { MnxDocument } from '../types/mnx.ts';
import { renderMnxToSvgTab } from '../tab/tabRenderer.ts';
import { renderMnxToSvgNotation } from '../notation/notationRenderer.ts';
import { isSmuflLoaded, loadSmufl } from '../smufl/smufl.ts';
import type { PinnedError } from '../utils/pinnedErrors.ts';
import type { ViewMode } from './ScoreToolbar.ts';
import { sharedChrome, scrollbars } from '../styles/tokens.ts';

/**
 * The score area: a scrollable bench with a warm PAPER card at its centre.
 * The paper carries the engraved SVG (the rendering engine is a black box
 * here), or one of two honest state panels:
 *  - invalid-by-design → the spec-gap exhibit (oxide, pinned-error table)
 *  - valid-but-unrendered → the "validates, doesn't render yet" panel
 * Paper never inverts with the theme (DIRECTION.md §4).
 */
@customElement('mnx-score-viewer')
export class ScoreViewer extends LitElement {
  @consume({ context: mnxDocumentContext, subscribe: true })
  @property({ attribute: false })
  mnxDoc!: MnxDocument | null;

  @consume({ context: playbackStateContext, subscribe: true })
  @property({ attribute: false })
  playbackState!: PlaybackState;

  @consume({ context: selectionContext, subscribe: true })
  @property({ attribute: false })
  selection!: SelectionContext;

  @property({ type: String }) viewMode: ViewMode = 'notation';
  @property({ type: Number }) zoom = 1;
  @property({ type: Boolean }) hasTab = false;
  @property({ type: Boolean }) invalidByDesign = false;
  @property({ attribute: false }) pinnedErrors: PinnedError[] = [];
  /** Pointer of the pinned error currently highlighted in the document pane. */
  @property({ type: String }) errorPointer: string | null = null;
  /** Embed trim: tighter paper margins. */
  @property({ type: Boolean, reflect: true }) compact = false;

  @query('#score-container')
  container!: HTMLElement;

  @state() private renderErrors: { pane: string; message: string }[] = [];

  private resizeHandler = () => this.renderScore();

  static styles = [
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: block;
        height: 100%;
        overflow: auto;
        padding: 26px;
        min-width: 0;
        background: var(--bg);
      }

      :host([compact]) {
        padding: 16px;
      }

      .paper {
        background: var(--paper);
        color: var(--paper-ink);
        border-radius: 10px;
        box-shadow: var(--shadow);
        border: 1px solid oklch(0.85 0.01 85 / 0.6);
        padding: 30px 26px;
        margin: 0 auto;
        transition: width 0.15s ease;
      }

      :host([compact]) .paper {
        padding: 16px 14px;
        border-radius: 8px;
      }

      .pane-cap {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--paper-line);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin: 0 0 4px 4px;
      }

      .both-gap {
        height: 26px;
      }

      /* Compact embed chrome (the container lives on the host card). */
      @container mnx-embed (max-width: 419px) {
        .pane-cap {
          display: none;
        }
      }

      #score-container svg {
        display: block;
        width: 100%;
        height: auto;
        pointer-events: auto;
        color: var(--paper-ink);
      }

      #score-container svg .staff-line {
        stroke: var(--paper-line);
      }

      #score-container svg .notehead {
        cursor: pointer;
        transition: fill 0.12s;
      }

      /* Selection/active recolor to the accent — overrides the engine's
         presentation attributes (CSS wins over attributes). */
      #score-container svg .notehead.selected,
      #score-container svg .notehead.active,
      #score-container svg .accidental.selected,
      #score-container svg .accidental.active {
        fill: var(--accent) !important;
      }

      #score-container svg .fret-number {
        cursor: pointer;
      }

      #score-container svg .fret-number.selected,
      #score-container svg .fret-number.active {
        fill: var(--accent) !important;
      }

      /* The tab fret knock-out must match the paper, not the app bg. */
      #score-container svg .fret-bg {
        fill: var(--paper) !important;
      }

      .no-doc {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
        color: var(--paper-line);
        font-size: 13px;
      }

      /* ── state panels (on paper — warm fixed colors, never themed) ── */
      .state-panel {
        max-width: 60ch;
        margin: 8px auto;
        padding: 8px 4px;
      }

      .state-panel h3 {
        display: flex;
        align-items: center;
        gap: 9px;
        font-family: var(--serif);
        font-size: 17px;
        font-weight: 500;
        margin: 0 0 8px;
      }

      .state-panel .sp-dia {
        width: 10px;
        height: 10px;
        background: oklch(0.55 0.125 42);
        transform: rotate(45deg);
        border-radius: 2px;
        flex-shrink: 0;
      }

      .state-panel .sp-warn {
        width: 10px;
        height: 10px;
        background: oklch(0.66 0.105 78);
        border-radius: 50%;
        flex-shrink: 0;
      }

      .state-panel p {
        font-size: 12.5px;
        line-height: 1.6;
        color: oklch(0.4 0.012 80);
        margin: 0 0 10px;
        text-wrap: pretty;
      }

      .err-table {
        border: 1px solid oklch(0.85 0.02 60);
        border-radius: 8px;
        overflow: hidden;
        margin-top: 12px;
      }

      .err-row {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 10px 14px;
        background: oklch(0.97 0.012 60);
        cursor: pointer;
        width: 100%;
        text-align: left;
      }

      .err-row:hover {
        background: oklch(0.95 0.018 60);
      }

      .err-row .er-rule {
        font-family: var(--mono);
        font-size: 11px;
        font-weight: 600;
        color: oklch(0.55 0.125 42);
      }

      .err-row .er-msg {
        font-size: 12px;
        color: oklch(0.38 0.012 80);
      }

      .err-row .er-path {
        font-family: var(--mono);
        font-size: 10px;
        color: oklch(0.55 0.012 80);
      }

      .fail-code {
        font-family: var(--mono);
        font-size: 11px;
        color: oklch(0.55 0.125 42);
        background: oklch(0.96 0.01 60);
        border: 1px solid oklch(0.88 0.015 60);
        border-radius: 6px;
        padding: 9px 12px;
        margin-top: 8px;
        display: block;
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('resize', this.resizeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.resizeHandler);
  }

  updated(changed: Map<string | number | symbol, unknown>) {
    if (
      changed.has('mnxDoc') ||
      changed.has('playbackState') ||
      changed.has('selection') ||
      changed.has('viewMode') ||
      changed.has('zoom') ||
      changed.has('invalidByDesign')
    ) {
      this.renderScore();
    }
  }

  renderScore() {
    if (!this.container || !this.mnxDoc || this.invalidByDesign) return;

    // Embeds can reach here before the SMuFL metadata fetch resolves (the
    // full app usually renders after a user gesture). Defer one round trip.
    if (!isSmuflLoaded()) {
      loadSmufl().then(() => this.renderScore());
      return;
    }

    const width = this.container.getBoundingClientRect().width || 600;
    const failures: { pane: string; message: string }[] = [];

    const onNoteClick = (noteId: string, measureIdx: number, noteIdx: number) => {
      this.dispatchEvent(
        new CustomEvent('note-selected', {
          detail: { noteId, measureIdx, noteIdx },
          bubbles: true,
          composed: true
        })
      );
    };

    const commonOpts = {
      mnx: this.mnxDoc.mnxJson,
      width,
      activeNoteIds: this.playbackState?.activeNoteIds ?? [],
      selectedNoteIds: this.selection?.selectedNoteIds ?? [],
      onNoteClick
    };

    // The layout engine throws on documents using features it doesn't support
    // yet — that's the honest "validates, doesn't render" state, not a crash.
    const guarded = (target: HTMLElement, label: string, fn: () => void) => {
      try {
        fn();
      } catch (err) {
        target.innerHTML = '';
        failures.push({ pane: label, message: (err as Error).message });
      }
    };

    this.container.innerHTML = '';
    if (this.viewMode === 'tab') {
      const pane = this.appendPane(this.hasTab ? 'tab · _x.mnxLab.tab' : null);
      guarded(pane, 'tab', () => renderMnxToSvgTab({ container: pane, ...commonOpts }));
    } else if (this.viewMode === 'notation') {
      const pane = this.appendPane(this.hasTab ? 'notation' : null);
      guarded(pane, 'notation', () =>
        renderMnxToSvgNotation({ container: pane, ...commonOpts })
      );
    } else {
      const notationPane = this.appendPane('notation');
      const gap = document.createElement('div');
      gap.className = 'both-gap';
      this.container.appendChild(gap);
      const tabPane = this.appendPane('tab · _x.mnxLab.tab');
      guarded(notationPane, 'notation', () =>
        renderMnxToSvgNotation({ container: notationPane, ...commonOpts })
      );
      guarded(tabPane, 'tab', () => renderMnxToSvgTab({ container: tabPane, ...commonOpts }));
    }

    // Only update state when it changed, to avoid a render loop.
    if (JSON.stringify(failures) !== JSON.stringify(this.renderErrors)) {
      this.renderErrors = failures;
    }
  }

  private appendPane(caption: string | null): HTMLElement {
    if (caption) {
      const cap = document.createElement('p');
      cap.className = 'pane-cap';
      cap.textContent = caption;
      this.container.appendChild(cap);
    }
    const pane = document.createElement('div');
    this.container.appendChild(pane);
    return pane;
  }

  render() {
    const paperWidth = `min(100%, ${Math.round(820 * this.zoom)}px)`;

    if (!this.mnxDoc) {
      return html`
        <div class="paper" style="width: ${paperWidth}">
          <div class="no-doc">No document loaded</div>
        </div>
      `;
    }

    if (this.invalidByDesign) {
      return html`
        <div class="paper" style="width: ${paperWidth}">
          <div class="state-panel">
            <h3><span class="sp-dia"></span>Invalid by design — a spec-gap exhibit</h3>
            <p>
              This document is deliberately rejected by the official MNX schema. The validation
              errors below are pinned: if a schema bump makes this document start passing, the
              corpus tests flag it as a spec-evolution signal. Rendering is skipped — the document
              itself is the exhibit.
            </p>
            <div class="err-table">
              ${this.pinnedErrors.map(
                err => html`
                  <button
                    class="err-row"
                    title="Click to locate the offending value in the document"
                    @click=${() => this.emitError(err)}
                  >
                    <span class="er-rule"
                      >${err.rule}${this.errorPointer != null && this.errorPointer === err.pointer
                        ? ' · highlighted in document →'
                        : ''}</span
                    >
                    <span class="er-msg">${err.msg}</span>
                    ${err.path ? html`<span class="er-path">${err.path}</span>` : nothing}
                  </button>
                `
              )}
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="paper" style="width: ${paperWidth}">
        ${this.renderErrors.length
          ? html`
              <div class="state-panel">
                <h3><span class="sp-warn"></span>Validates, doesn’t render yet</h3>
                <p>
                  The document passes both verdicts, but the layout engine doesn’t support a
                  feature it uses. That’s an honest gap, not an error — the uncovered def sits on
                  the coverage backlog, and this scenario is its test fixture-in-waiting.
                </p>
                ${this.renderErrors.map(
                  f => html`<code class="fail-code">layout (${f.pane}): ${f.message}</code>`
                )}
              </div>
            `
          : nothing}
        <div id="score-container"></div>
      </div>
    `;
  }

  private emitError(err: PinnedError) {
    this.dispatchEvent(
      new CustomEvent('error-row-selected', {
        detail: { pointer: err.pointer },
        bubbles: true,
        composed: true
      })
    );
  }
}

export default ScoreViewer;
