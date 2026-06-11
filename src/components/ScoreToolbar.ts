import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { sharedChrome } from '../styles/tokens.ts';

export type ViewMode = 'notation' | 'tab' | 'both';

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 1.75;
const ZOOM_STEP = 0.25;

/**
 * Score toolbar: view segmented control (what music to draw), zoom, compact
 * playback (play + bpm — a pure function of the document), copy json, and
 * the document-pane toggle. JSON is deliberately NOT a view mode — seeing
 * the document is orthogonal to what's drawn (DIRECTION.md §3).
 */
@customElement('mnx-score-toolbar')
export class ScoreToolbar extends LitElement {
  @property({ type: String }) view: ViewMode = 'notation';
  @property({ type: Boolean }) hasTab = false;
  @property({ type: Boolean }) canRender = false;
  @property({ type: Number }) zoom = 1;
  @property({ type: Boolean }) playing = false;
  @property({ type: Number }) bpm = 96;
  @property({ type: Boolean }) showJson = false;

  static styles = [
    sharedChrome,
    css`
      :host {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 24px 10px;
        flex-wrap: wrap;
      }

      .tb-spacer {
        flex: 1;
      }

      .tb-group {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .tb-mono {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-2);
        min-width: 38px;
        text-align: center;
      }

      .tb-div {
        width: 1px;
        height: 18px;
        background: var(--line);
        margin: 0 2px;
      }

      .bpm-in {
        width: 44px;
        height: 28px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--surface);
        font-family: var(--mono);
        font-size: 11px;
        text-align: center;
        outline: none;
      }
    `
  ];

  render() {
    const tabTitle = this.hasTab ? undefined : 'No _x.tab part in this document';
    return html`
      <div class="seg" role="group" aria-label="View mode">
        <button
          class=${this.view === 'notation' ? 'on' : ''}
          ?disabled=${!this.canRender}
          @click=${() => this.emitView('notation')}
        >
          Notation
        </button>
        <button
          class=${this.view === 'tab' ? 'on' : ''}
          ?disabled=${!this.hasTab || !this.canRender}
          title=${tabTitle ?? ''}
          @click=${() => this.emitView('tab')}
        >
          Tab
        </button>
        <button
          class=${this.view === 'both' ? 'on' : ''}
          ?disabled=${!this.hasTab || !this.canRender}
          title=${tabTitle ?? ''}
          @click=${() => this.emitView('both')}
        >
          Both
        </button>
      </div>
      <div class="tb-spacer"></div>
      <div class="tb-group">
        <button class="tb-btn" ?disabled=${this.zoom <= ZOOM_MIN} @click=${() => this.emitZoom(-1)}>
          −
        </button>
        <span class="tb-mono">${Math.round(this.zoom * 100)}%</span>
        <button class="tb-btn" ?disabled=${this.zoom >= ZOOM_MAX} @click=${() => this.emitZoom(1)}>
          +
        </button>
      </div>
      <div class="tb-div"></div>
      <div
        class="tb-group"
        title=${this.canRender
          ? 'Playback is a pure function of the document (Tone.js)'
          : 'Nothing to play — document doesn’t render'}
      >
        <button
          class="tb-btn"
          ?disabled=${!this.canRender}
          aria-label=${this.playing ? 'Stop' : 'Play'}
          @click=${this.emitPlay}
        >
          ${this.playing
            ? svg`<svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor"></rect></svg>`
            : svg`<svg width="10" height="10" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"></polygon></svg>`}
        </button>
        <input
          class="bpm-in"
          type="number"
          min="40"
          max="220"
          .value=${String(this.bpm)}
          ?disabled=${!this.canRender}
          @change=${this.handleBpm}
        />
        <span class="tb-mono" style="min-width: 26px; text-align: left">bpm</span>
      </div>
      <div class="tb-div"></div>
      <button class="tb-btn" title="Copy score JSON" @click=${this.emitCopy}>copy json</button>
      <button
        class="tb-btn ${this.showJson ? 'on' : ''}"
        title="Show the MNX document beside the rendering"
        @click=${this.emitJson}
      >
        ${svg`<svg width="12" height="10" viewBox="0 0 12 10"><rect x="0.5" y="0.5" width="11" height="9" rx="1.5" fill="none" stroke="currentColor"></rect><line x1="7" y1="0.5" x2="7" y2="9.5" stroke="currentColor"></line></svg>`}
        json
      </button>
    `;
  }

  private emitView(view: ViewMode) {
    this.dispatchEvent(
      new CustomEvent('view-changed', { detail: { view }, bubbles: true, composed: true })
    );
  }

  private emitZoom(dir: 1 | -1) {
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom + dir * ZOOM_STEP));
    this.dispatchEvent(
      new CustomEvent('zoom-changed', { detail: { zoom }, bubbles: true, composed: true })
    );
  }

  private emitPlay() {
    this.dispatchEvent(new CustomEvent('play-toggled', { bubbles: true, composed: true }));
  }

  private handleBpm(e: Event) {
    const input = e.target as HTMLInputElement;
    const bpm = Math.max(40, Math.min(220, Number(input.value) || 96));
    input.value = String(bpm);
    this.dispatchEvent(
      new CustomEvent('tempo-changed', { detail: { bpm }, bubbles: true, composed: true })
    );
  }

  private emitCopy() {
    this.dispatchEvent(new CustomEvent('copy-json-requested', { bubbles: true, composed: true }));
  }

  private emitJson() {
    this.dispatchEvent(new CustomEvent('json-toggled', { bubbles: true, composed: true }));
  }
}

export default ScoreToolbar;
