import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  mnxDocumentContext,
  playbackStateContext,
  selectionContext
} from './mnxContext.ts';
import type { PlaybackState, SelectionContext } from './mnxContext.ts';
import { MnxDocument, MnxPart, MnxTuningEntry } from '../model/mnx.ts';
import type { PartTabSetups, TabSetup } from '../engine/tab/guitarPositions.ts';
import { renderMnxToSvgTab } from '../engine/tab/tabRenderer.ts';
import { renderMnxToSvgNotation } from '../engine/notation/notationRenderer.ts';
import { renderMnxToSvgBoth } from '../engine/both/bothRenderer.ts';
import { isSmuflLoaded, loadSmufl } from '../engine/smufl/smufl.ts';
import { drawCursorGhost, drawEnclosure } from './enclosure.ts';
import type { PinnedError } from '../model/pinnedErrors.ts';
// The view-mode axis belongs to the embeddable surface: the shell's toolbar
// imports it from here, never the other way around.
export type ViewMode = 'notation' | 'tab' | 'both';
import { sharedChrome, scrollbars } from './tokens.ts';

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
  /**
   * Viewer-supplied instrument: overrides the document's `_x.mnxLab.strings`
   * / `capo` for rendering (presentation only — never written back). Without
   * either source, no instrument is assumed and tab staves don't render.
   * The flat pair applies to EVERY part — right for single-instrument
   * documents, wrong for ensembles (it clobbers parts that declared their
   * own strings and hands the rest an instrument they never asked for).
   */
  @property({ attribute: false }) stringsOverride: MnxTuningEntry[] | null = null;
  @property({ type: Number }) capoOverride: number | null = null;
  /**
   * Per-part instrument overrides (roadmap/inprogress/core-score-hud.md),
   * keyed by part `id` when the part has one, else by its index as a string.
   * Mirrors the shape of the declaration it stands in for — `_x.mnxLab`
   * strings/capo live on the part. Per part it wins over the flat pair
   * above, which remains the fallback for parts without an entry.
   */
  @property({ attribute: false }) partTabSetups: Record<string, TabSetup> | null = null;
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

  /** One-shot re-render when the Bravura font file finishes loading: the
   *  enclosure overlay measures glyph boxes, and a first paint that races the
   *  font would freeze fallback-font geometry into the highlight. */
  private fontRedrawQueued = false;

  static styles = [
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: block;
        height: 100%;
        overflow: auto;
        padding: 5px;
        min-width: 0;
        background: var(--bg);
      }

      /* Keyboard ownership, made visible (core-editor-focus-scope.md).
         :focus-within, not :focus — a popover input inside the component
         still means the keyboard is ours, and the ring must not blink off
         mid-typing. Outline rather than border: no reflow, and it draws
         outside the box so the paper's geometry is untouched. Click focus
         counts on purpose — for an editor, a click really does transfer key
         ownership. */
      :host(:focus-within) {
        outline: 2px solid var(--focus-ring);
        outline-offset: -2px;
      }

      /* The host is the focus target; its own ring is the signal above. */
      :host(:focus) {
        outline-color: var(--focus-ring);
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

      /* Honor the engine's intrinsic size — fitPxPerSp already fills the
         width up to FIT_MAX_PX_PER_SP; stretching past it would defeat the
         cap and turn one-bar scenarios into posters. */
      #score-container svg {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 auto;
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

      /* The selection-ladder enclosure (enclosure.ts): one vocabulary, fill
         fading and border firming as the level widens — cell → slice → beads
         → panel → panel-wide → frame. Behind the ink, never clickable. */
      #score-container svg .enclosure {
        pointer-events: none;
      }

      #score-container svg .enclosure rect {
        fill: var(--accent);
        stroke: var(--accent);
      }

      #score-container svg .enc-cell rect {
        fill-opacity: 0.16;
        stroke-opacity: 0.9;
      }

      #score-container svg .enc-slice rect {
        fill-opacity: 0.13;
        stroke-opacity: 0.6;
      }

      #score-container svg .enc-run rect {
        fill-opacity: 0.13;
        stroke-opacity: 0.55;
      }

      #score-container svg .enc-panel rect {
        fill-opacity: 0.09;
        stroke-opacity: 0.45;
      }

      #score-container svg .enc-panel-wide rect {
        fill-opacity: 0.06;
        stroke-opacity: 0.5;
      }

      #score-container svg .enc-frame rect {
        fill-opacity: 0;
        stroke-opacity: 0.75;
      }

      /* The cursor's ghost cell: hollow, dashed — a place for a thing. */
      #score-container svg .cursor-ghost {
        pointer-events: none;
      }

      #score-container svg .cursor-ghost rect {
        fill: none;
        stroke: var(--accent);
        stroke-opacity: 0.8;
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
    // Focusable by default (core-editor-focus-scope.md): a custom element
    // cannot be document.activeElement without a tabindex, so "the keyboard
    // is ours while focus is inside us" is not even expressible until this
    // exists. A host page may override — tabindex="-1" for click-only focus,
    // or its own order — so an author-set value is never clobbered.
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
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
      changed.has('invalidByDesign') ||
      changed.has('stringsOverride') ||
      changed.has('capoOverride') ||
      changed.has('partTabSetups')
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

    const flatSetup: TabSetup | undefined =
      this.stringsOverride || this.capoOverride !== null
        ? {
            ...(this.stringsOverride ? { strings: this.stringsOverride } : {}),
            ...(this.capoOverride !== null ? { capo: this.capoOverride } : {})
          }
        : undefined;
    // Per-part overrides resolve by part id, then index; a part without an
    // entry falls back to the flat pair (which applies to every part).
    const perPart = this.partTabSetups;
    const tabSetup: PartTabSetups | undefined = perPart
      ? (part: MnxPart) => {
          const parts = this.mnxDoc?.mnxJson.parts ?? [];
          return (
            (part.id !== undefined ? perPart[part.id] : undefined) ??
            perPart[String(parts.indexOf(part))] ??
            flatSetup
          );
        }
      : flatSetup;

    // The selection-ladder enclosure: drawn from the finished SVG's own
    // geometry, after the engine is done — the renderer never learns about
    // editor state, the overlay reads what it drew.
    const enclosed = (pane: HTMLElement) => {
      const kind = this.selection?.enclosure;
      const svg = pane.querySelector('svg');
      if (kind && svg) {
        drawEnclosure(svg, kind);
        // The ghost cell: the cursor's own cell when empty (note level only —
        // wider rungs select what exists, the ghost is an entry affordance).
        const ghost = this.selection?.cursor;
        if (kind === 'cell' && ghost) drawCursorGhost(svg, ghost);
        if (!this.fontRedrawQueued && !document.fonts.check('4px Bravura')) {
          this.fontRedrawQueued = true;
          void document.fonts.ready.then(() => this.renderScore());
        }
      }
    };

    // No pane captions: the view is named by whichever surface hosts this
    // element (the workbench's tabs, an embed host's chrome) — a label inside
    // the paper spent engraving space restating it.
    this.container.innerHTML = '';
    if (this.viewMode === 'tab') {
      const pane = this.appendPane();
      guarded(pane, 'tab', () => {
        renderMnxToSvgTab({ container: pane, ...commonOpts, tabSetup });
        enclosed(pane);
      });
    } else if (this.viewMode === 'notation') {
      const pane = this.appendPane();
      guarded(pane, 'notation', () => {
        renderMnxToSvgNotation({ container: pane, ...commonOpts });
        enclosed(pane);
      });
    } else {
      // One composed system — notation staff over tab staff in a single SVG
      // with joined barlines (src/engine/layout/bothSystem.ts), not two
      // stacked renders.
      const pane = this.appendPane();
      guarded(pane, 'both', () => {
        renderMnxToSvgBoth({ container: pane, ...commonOpts, tabSetup });
        enclosed(pane);
      });
    }

    // Only update state when it changed, to avoid a render loop.
    if (JSON.stringify(failures) !== JSON.stringify(this.renderErrors)) {
      this.renderErrors = failures;
    }
  }

  private appendPane(): HTMLElement {
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
