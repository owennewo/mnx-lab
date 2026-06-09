import { LitElement, html, css } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, property, query } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { mnxDocumentContext, playbackStateContext, selectionContext } from '../contexts/mnxContext.ts';
import type { PlaybackState, SelectionContext } from '../contexts/mnxContext.ts';
import { MnxDocument } from '../types/mnx.ts';
import { renderMnxToVexflow } from '../utils/mnxToVexflow.ts';
import { renderMnxToSvgTab } from '../tab/tabRenderer.ts';
import { renderMnxToSvgNotation } from '../notation/notationRenderer.ts';

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

  @property({ type: String })
  viewMode: 'notation' | 'tab' | 'both' | 'json' = 'notation';

  @query('#vexflow-container')
  container!: HTMLElement;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 20px;
      background: oklch(0.18 0.02 256 / 0.5);
      border-radius: 12px;
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-premium);
      backdrop-filter: var(--glass-blur);
    }

    #score-wrapper {
      position: relative;
      width: 100%;
      min-height: 400px;
      background: rgba(255, 255, 255, 0.015);
      border-radius: 8px;
      padding: 12px;
      border: 1px dashed rgba(255, 255, 255, 0.08);
    }

    #vexflow-container {
      width: 100%;
    }

    .no-doc {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 300px;
      color: var(--text-muted);
      font-size: 1.1rem;
    }

    /* Make VexFlow SVG fit the dark mode.
       Notice we do NOT use !important on fills/strokes,
       so Vexflow's inline highlighted colors can override this.
       Scoped with :not(.mnx-tab-svg) so the new tab renderer drives its own colors. */
    #vexflow-container svg:not(.mnx-tab-svg):not(.mnx-notation-svg) {
      fill: var(--text-primary);
    }

    #vexflow-container svg:not(.mnx-tab-svg):not(.mnx-notation-svg) path,
    #vexflow-container svg:not(.mnx-tab-svg):not(.mnx-notation-svg) rect:not([fill="white"]) {
      fill: var(--text-primary);
      stroke: var(--text-primary);
    }

    #vexflow-container svg:not(.mnx-tab-svg):not(.mnx-notation-svg) rect[fill="white"] {
      fill: oklch(0.18 0.02 256) !important;
      stroke: none !important;
    }

    #vexflow-container svg:not(.mnx-tab-svg):not(.mnx-notation-svg) text {
      fill: inherit;
    }

    /* But we can override line drawing details to match the grid theme */
    #vexflow-container svg:not(.mnx-tab-svg):not(.mnx-notation-svg) path.vf-stave {
      stroke: oklch(0.4 0.02 256) !important;
    }

    #vexflow-container svg {
      pointer-events: auto !important;
    }

    #vexflow-container svg g {
      pointer-events: auto !important;
    }

    /* New MNX-native tab renderer styles */
    #vexflow-container svg.mnx-tab-svg {
      color: var(--text-primary);
      display: block;
    }

    #vexflow-container svg.mnx-tab-svg .staff-line {
      stroke: oklch(0.45 0.02 256);
    }

    #vexflow-container svg.mnx-tab-svg .tab-event:hover .fret-number {
      fill: var(--primary-glow);
    }

    /* New MNX-native notation renderer styles */
    #vexflow-container svg.mnx-notation-svg {
      color: var(--text-primary);
      display: block;
    }

    #vexflow-container svg.mnx-notation-svg .staff-line {
      stroke: oklch(0.45 0.02 256);
    }

    #vexflow-container svg.mnx-notation-svg .notehead {
      cursor: pointer;
    }

    #json-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 400px;
      background: oklch(0.12 0.02 256 / 0.8);
      border-radius: 8px;
      padding: 20px;
      border: 1px solid var(--border-color);
      overflow: auto;
      box-sizing: border-box;
    }

    #json-wrapper pre {
      margin: 0;
      font-family: var(--font-family-mono);
      font-size: 0.88rem;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .json-key {
      color: oklch(0.75 0.15 190); /* Electric cyan */
      font-weight: 600;
    }

    .json-string {
      color: oklch(0.8 0.12 120); /* Soft lime green */
    }

    .json-number {
      color: oklch(0.75 0.16 40); /* Soft amber/orange */
    }

    .json-boolean {
      color: oklch(0.65 0.22 274); /* Vibrant violet */
      font-weight: bold;
    }

    .json-null {
      color: var(--text-muted);
      font-style: italic;
    }
  `;

  firstUpdated() {
    this.renderScore();
    window.addEventListener('resize', () => this.renderScore());
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('mnxDoc') || 
        changedProperties.has('playbackState') || 
        changedProperties.has('selection') ||
        changedProperties.has('viewMode')) {
      this.renderScore();
    }
  }

  renderScore() {
    if (this.viewMode === 'json') return;
    if (!this.container || !this.mnxDoc) return;

    const width = this.container.getBoundingClientRect().width || 600;

    const onNoteClick = (noteId: string, measureIdx: number, noteIdx: number) => {
      this.dispatchEvent(new CustomEvent('note-selected', {
        detail: { noteId, measureIdx, noteIdx },
        bubbles: true,
        composed: true
      }));
    };

    if (this.viewMode === 'tab') {
      renderMnxToSvgTab({
        container: this.container,
        mnx: this.mnxDoc.mnxJson,
        width,
        activeNoteIds: this.playbackState?.activeNoteIds ?? [],
        selectedNoteIds: this.selection?.selectedNoteIds ?? [],
        onNoteClick
      });
      return;
    }

    if (this.viewMode === 'notation') {
      renderMnxToSvgNotation({
        container: this.container,
        mnx: this.mnxDoc.mnxJson,
        width,
        activeNoteIds: this.playbackState?.activeNoteIds ?? [],
        selectedNoteIds: this.selection?.selectedNoteIds ?? [],
        onNoteClick
      });
      return;
    }

    const numMeasures = this.mnxDoc.mnxJson.parts?.[0]?.measures?.length ?? 0;
    const measuresPerRow = width > 800 ? 4 : 2;
    const rows = Math.ceil(numMeasures / measuresPerRow);
    const rowHeight = this.viewMode === 'both' ? 220 : 130;
    const calculatedHeight = Math.max(300, rows * rowHeight + 40);

    renderMnxToVexflow({
      container: this.container,
      mnx: this.mnxDoc.mnxJson,
      width: width,
      height: calculatedHeight,
      activeNoteIds: this.playbackState?.activeNoteIds ?? [],
      selectedNoteIds: this.selection?.selectedNoteIds ?? [],
      viewMode: this.viewMode,
      onNoteClick
    });
  }

  render() {
    if (!this.mnxDoc) {
      return html`<div class="no-doc">No score loaded</div>`;
    }

    if (this.viewMode === 'json') {
      const highlighted = syntaxHighlight(this.mnxDoc.mnxJson);
      return html`
        <div id="json-wrapper">
          <pre><code>${unsafeHTML(highlighted)}</code></pre>
        </div>
      `;
    }

    return html`
      <div id="score-wrapper">
        <div id="vexflow-container"></div>
      </div>
    `;
  }
}

function syntaxHighlight(jsonObj: any): string {
  const json = JSON.stringify(jsonObj, null, 2);
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return `<span class="json-${cls}">${match}</span>`;
    }
  );
}

export default ScoreViewer;
