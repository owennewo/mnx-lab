import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property, query } from 'lit/decorators.js';
import { provide } from '@lit/context';
import {
  mnxDocumentContext,
  playbackStateContext,
  selectionContext
} from '../contexts/mnxContext.ts';
import type { PlaybackState, SelectionContext } from '../contexts/mnxContext.ts';
import { MnxDocument, MnxStructure } from '../types/mnx.ts';
import { PlaybackController } from '../controllers/PlaybackController.ts';
import { ScenarioLibraryController } from '../controllers/ScenarioLibraryController.ts';
import { corpus, corpusManifest, coverage, type ScenarioEntry } from '../library/corpus.ts';
import { describeNote } from '../utils/jsonView.ts';
import { resolvePinnedErrors, type PinnedError } from '../utils/pinnedErrors.ts';
import { designTokens, sharedChrome } from '../styles/tokens.ts';
import { brandMark } from './marks.ts';
import type { ViewMode } from './ScoreToolbar.ts';
import type { AssistDrawer } from './AssistDrawer.ts';
import './LibraryRail.ts';
import './CoverageDashboard.ts';
import './ScenarioHeader.ts';
import './ScoreToolbar.ts';
import './ScoreViewer.ts';
import './DocumentPane.ts';
import './AssistDrawer.ts';

type Theme = 'light' | 'dark' | 'auto';

interface Sketch {
  /** The corpus entry the sketch was forked from (never mutated). */
  base: ScenarioEntry;
  mnxJson: MnxStructure;
}

const EMPTY_SELECTION: SelectionContext = {
  activePartId: null,
  activeMeasureIndex: null,
  activeVoiceIndex: null,
  activeEventIndex: null,
  selectedNoteIds: []
};

/**
 * MNX Lab — "the reading room" (claude_design/…/DIRECTION.md). The scenario
 * library is permanent navigation, the scenario page is the main surface,
 * the coverage dashboard is the empty state, and editing/AI are demoted to
 * the Assist drawer, which only ever operates on transient sketches.
 */
@customElement('mnx-editor-app')
export class MnxEditorApp extends LitElement {
  // ── context providers (mirrored from controllers in willUpdate) ──
  @provide({ context: mnxDocumentContext })
  @state()
  documentState: MnxDocument | null = null;

  @provide({ context: playbackStateContext })
  @state()
  playbackState: PlaybackState = {
    playing: false,
    tempo: 96,
    volume: -10,
    playheadTime: 0,
    activeNoteIds: []
  };

  @provide({ context: selectionContext })
  @state()
  selectionState: SelectionContext = EMPTY_SELECTION;

  // ── public attribute API (embedders) ──
  @property({ type: String, reflect: true }) theme: Theme = 'light';

  // ── shell state ──
  @state() private viewMode: ViewMode = 'notation';
  @state() private showDocumentPane = true;
  @state() private zoom = 1;
  @state() private assistOpen = false;
  @state() private railOpen = false;
  @state() private sketch: Sketch | null = null;
  @state() private pinnedErrors: PinnedError[] = [];
  @state() private errorPointer: string | null = null;

  private playbackController = new PlaybackController(this);
  library = new ScenarioLibraryController(this);

  @query('.hdr-search input')
  private headerSearch?: HTMLInputElement;

  private keyHandler = (e: KeyboardEvent) => this.handleKeydown(e);
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private mediaHandler = () => this.applyResolvedTheme();

  static styles = [
    designTokens,
    sharedChrome,
    css`
      :host {
        display: grid;
        grid-template-rows: var(--header-h) 1fr var(--footer-h);
        height: 100%;
        background: var(--bg);
      }

      /* ── header ── */
      .hdr {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0 16px 0 14px;
        border-bottom: 1px solid var(--line);
        background: var(--bg);
        min-width: 0;
      }

      .hdr-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 30px;
        padding: 0 11px;
        border: 1px solid var(--line);
        border-radius: 6px;
        font-size: 12.5px;
        color: var(--ink-2);
        background: var(--surface);
        white-space: nowrap;
      }

      .hdr-btn:hover {
        background: var(--hover);
        color: var(--ink);
      }

      .hdr-btn.on {
        border-color: var(--accent-fg);
        color: var(--accent-fg);
      }

      .hdr-btn.icon {
        width: 30px;
        padding: 0;
        justify-content: center;
      }

      .hdr-btn.burger {
        display: none;
      }

      .wordmark {
        display: flex;
        align-items: center;
        gap: 9px;
      }

      .wordmark .mark line {
        stroke: var(--ink);
        stroke-width: 1.1;
      }

      .wordmark .mark ellipse {
        fill: var(--accent-fg);
      }

      .wordmark .wm-t {
        font-weight: 600;
        font-size: 15px;
        letter-spacing: -0.01em;
      }

      .wordmark .wm-t em {
        font-family: var(--serif);
        font-style: italic;
        font-weight: 500;
        color: var(--ink-2);
        margin-left: 1px;
      }

      .env-chip {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        border: 1px solid var(--line);
        border-radius: 4px;
        padding: 2px 7px;
        white-space: nowrap;
      }

      .hdr-spacer {
        flex: 1;
      }

      .metric-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-2);
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 4px 10px;
        white-space: nowrap;
      }

      .metric-chip:hover {
        background: var(--hover);
      }

      .metric-chip .mdot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--st-rendered);
      }

      .hdr-search {
        position: relative;
        width: 230px;
      }

      .hdr-search input {
        width: 100%;
        height: 30px;
        padding: 0 28px 0 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--surface);
        font-size: 12.5px;
        outline: none;
      }

      .hdr-search input:focus {
        border-color: var(--accent-fg);
      }

      .hdr-search kbd {
        position: absolute;
        right: 7px;
        top: 6px;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--ink-3);
        border: 1px solid var(--line);
        border-radius: 3px;
        padding: 0 5px;
        line-height: 16px;
        background: var(--bg);
      }

      /* ── middle ── */
      .mid {
        display: grid;
        grid-template-columns: var(--rail-w) 1fr;
        min-height: 0;
      }

      .main {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }

      .score-area {
        flex: 1;
        display: flex;
        min-height: 0;
        border-top: 1px solid var(--line);
      }

      mnx-score-viewer {
        flex: 1;
        min-width: 0;
      }

      mnx-document-pane {
        width: 400px;
        flex-shrink: 0;
      }

      /* ── footer ── */
      .ftr {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 0 16px;
        border-top: 1px solid var(--line);
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        background: var(--bg);
        white-space: nowrap;
        overflow: hidden;
      }

      .ftr .sel-info {
        color: var(--ink-2);
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ftr .sel-info b {
        color: var(--accent-fg);
        font-weight: 500;
      }

      /* ── responsive ── */
      @media (max-width: 1240px) {
        mnx-document-pane {
          width: 340px;
        }
      }

      @media (max-width: 980px) {
        .mid {
          grid-template-columns: 1fr;
        }

        mnx-library-rail {
          position: fixed;
          top: var(--header-h);
          bottom: var(--footer-h);
          left: 0;
          width: var(--rail-w);
          z-index: 25;
          transform: translateX(-103%);
          transition: transform 0.18s ease;
          box-shadow: 8px 0 28px -10px oklch(0 0 0 / 0.25);
        }

        mnx-library-rail[open] {
          transform: none;
        }

        .hdr-btn.burger {
          display: flex;
        }

        .hdr-search {
          width: 150px;
        }

        .env-chip,
        .metric-chip {
          display: none;
        }

        mnx-document-pane {
          width: 300px;
        }
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    const saved = localStorage.getItem('mnx-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'auto') this.theme = saved;
    this.applyResolvedTheme();
    window.addEventListener('keydown', this.keyHandler);
    this.mediaQuery.addEventListener('change', this.mediaHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.keyHandler);
    this.mediaQuery.removeEventListener('change', this.mediaHandler);
  }

  private applyResolvedTheme() {
    const resolved =
      this.theme === 'auto' ? (this.mediaQuery.matches ? 'dark' : 'light') : this.theme;
    this.setAttribute('resolved-theme', resolved);
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('theme')) this.applyResolvedTheme();

    // The viewed document: a sketch, else the selected scenario — transient
    // either way; saved scores are untouched.
    const active = this.library.active;
    this.documentState = this.sketch
      ? {
          id: `sketch:${this.sketch.base.id}`,
          name: `${this.sketch.base.meta.title} — sketch`,
          lastUpdated: 0,
          mnxJson: this.sketch.mnxJson
        }
      : active
        ? {
            id: `scenario:${active.entry.id}`,
            name: active.entry.meta.title,
            lastUpdated: 0,
            mnxJson: active.mnxJson as MnxStructure
          }
        : null;

    this.playbackState = {
      playing: this.playbackController.isPlaying,
      tempo: this.playbackController.tempo,
      volume: this.playbackController.volume,
      playheadTime: this.playbackController.playheadBeat,
      activeNoteIds: this.playbackController.activeNoteIds
    };
  }

  render() {
    const active = this.library.active;
    const entry = active?.entry ?? null;
    const isSketch = this.sketch !== null;
    const hasPage = isSketch || entry !== null;
    const invalid = !isSketch && (entry?.invalidByDesign ?? false);
    const hasTab = isSketch ? this.sketch!.base.hasTab : (entry?.hasTab ?? false);
    const canRender =
      isSketch ||
      (!!entry && !invalid && (entry.meta.status === 'rendered' || entry.meta.status === 'verified'));
    const rendered = corpus.filter(
      e => e.meta.status === 'rendered' || e.meta.status === 'verified'
    ).length;

    return html`
      <header class="hdr">
        <button
          class="hdr-btn icon burger"
          aria-label="Toggle library"
          @click=${() => (this.railOpen = !this.railOpen)}
        >
          <svg width="13" height="11" viewBox="0 0 13 11">
            <line x1="0" y1="1.5" x2="13" y2="1.5" stroke="currentColor" stroke-width="1.4"></line>
            <line x1="0" y1="5.5" x2="13" y2="5.5" stroke="currentColor" stroke-width="1.4"></line>
            <line x1="0" y1="9.5" x2="13" y2="9.5" stroke="currentColor" stroke-width="1.4"></line>
          </svg>
        </button>
        <button class="wordmark" title="Coverage dashboard" @click=${this.goHome}>
          ${brandMark(20)}
          <span class="wm-t">MNX <em>Lab</em></span>
        </button>
        <span class="env-chip">MNX v${corpusManifest.mnxVersion} · _x.tab v${corpusManifest.tabVersion}</span>
        <div class="hdr-spacer"></div>
        <button class="metric-chip" title="Open the coverage dashboard" @click=${this.goHome}>
          <span class="mdot"></span>
          ${rendered}/${corpus.length} rendered
          <span style="opacity: 0.45">·</span>
          ${coverage.covered}/${coverage.total} defs
        </button>
        <div class="hdr-search">
          <input
            .value=${this.library.query}
            placeholder="Filter scenarios…"
            @input=${(e: Event) => this.library.setQuery((e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
            }}
          />
          <kbd>/</kbd>
        </div>
        <button
          class="hdr-btn ${this.assistOpen ? 'on' : ''}"
          title="AI editing — downstream; operates on sketches only"
          @click=${() => (this.assistOpen = !this.assistOpen)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.2"></circle>
            <circle cx="6" cy="6" r="1.4" fill="currentColor"></circle>
          </svg>
          Assist
        </button>
        <button class="hdr-btn icon" title="Toggle theme" aria-label="Toggle theme" @click=${this.toggleTheme}>
          <svg width="13" height="13" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.2"></circle>
            <path d="M7 1.5 a5.5 5.5 0 0 0 0 11 z" fill="currentColor"></path>
          </svg>
        </button>
      </header>

      <div class="mid">
        <mnx-library-rail
          .selectedId=${isSketch ? null : (entry?.id ?? null)}
          .facet=${this.library.facet}
          .status=${this.library.status}
          .query=${this.library.query}
          .idRefsOnly=${this.library.idRefsOnly}
          ?open=${this.railOpen}
          @scenario-selected=${this.handleScenarioSelected}
          @dashboard-requested=${this.goHome}
          @library-filter-changed=${this.handleFilterChanged}
        ></mnx-library-rail>

        ${hasPage
          ? html`
              <div class="main">
                <mnx-scenario-header
                  .entry=${isSketch ? this.sketch!.base : entry}
                  .notes=${isSketch ? null : (active?.notes ?? null)}
                  ?isSketch=${isSketch}
                  @def-facet-requested=${this.handleDefFacet}
                  @sketch-discarded=${this.discardSketch}
                ></mnx-scenario-header>
                <mnx-score-toolbar
                  .view=${this.viewMode}
                  ?hasTab=${hasTab}
                  ?canRender=${canRender}
                  .zoom=${this.zoom}
                  ?playing=${this.playbackState.playing}
                  .bpm=${this.playbackState.tempo}
                  ?showJson=${this.showDocumentPane}
                  @view-changed=${(e: CustomEvent) => (this.viewMode = e.detail.view)}
                  @zoom-changed=${(e: CustomEvent) => (this.zoom = e.detail.zoom)}
                  @play-toggled=${this.handlePlayToggle}
                  @tempo-changed=${(e: CustomEvent) => this.playbackController.setTempo(e.detail.bpm)}
                  @copy-json-requested=${this.handleCopyScoreJson}
                  @json-toggled=${() => (this.showDocumentPane = !this.showDocumentPane)}
                ></mnx-score-toolbar>
                <div class="score-area">
                  <mnx-score-viewer
                    .viewMode=${this.viewMode}
                    .zoom=${this.zoom}
                    ?hasTab=${hasTab}
                    ?invalidByDesign=${invalid}
                    .pinnedErrors=${this.pinnedErrors}
                    .errorPointer=${this.errorPointer}
                    @note-selected=${this.handleNoteSelect}
                    @error-row-selected=${this.handleErrorRow}
                  ></mnx-score-viewer>
                  ${this.showDocumentPane
                    ? html`
                        <mnx-document-pane
                          .doc=${this.documentState?.mnxJson ?? null}
                          .selectedKey=${this.selectionState.selectedNoteIds[0] ?? null}
                          .errorPointer=${this.errorPointer}
                          @document-line-selected=${this.handleDocumentLine}
                          @document-pane-closed=${() => (this.showDocumentPane = false)}
                        ></mnx-document-pane>
                      `
                    : nothing}
                </div>
              </div>
            `
          : html`
              <div class="main">
                <mnx-coverage-dashboard
                  @scenario-selected=${this.handleScenarioSelected}
                ></mnx-coverage-dashboard>
              </div>
            `}
      </div>

      ${this.assistOpen
        ? html`
            <mnx-assist-drawer
              .scenarioTitle=${isSketch
                ? `${this.sketch!.base.meta.title} — sketch`
                : (entry?.meta.title ?? null)}
              ?canFork=${canRender && !isSketch}
              ?isSketch=${isSketch}
              @fork-requested=${this.handleFork}
              @drawer-closed=${() => (this.assistOpen = false)}
              @chat-command-submitted=${this.handleChatCommand}
            ></mnx-assist-drawer>
          `
        : nothing}

      <footer class="ftr">
        <span>
          MNX v${corpusManifest.mnxVersion} · _x.tab v${corpusManifest.tabVersion} ·
          ${corpus.length} scenarios · spec/ synced ${corpusManifest.specSynced}
        </span>
        <span class="sel-info">${this.renderSelectionInfo(hasPage, canRender)}</span>
      </footer>
    `;
  }

  private renderSelectionInfo(hasPage: boolean, canRender: boolean) {
    const key = this.selectionState.selectedNoteIds[0];
    if (hasPage && key && this.documentState) {
      const desc = describeNote(this.documentState.mnxJson, key);
      if (desc) {
        return html`selected <b>${desc.label}</b> · measure ${desc.measure} · highlighted in document`;
      }
    }
    if (hasPage && canRender) {
      return 'click a notehead — or a note line in the JSON — to cross-locate it';
    }
    return 'no selection';
  }

  // ── navigation ──

  private goHome = () => {
    this.sketch = null;
    this.errorPointer = null;
    this.selectionState = EMPTY_SELECTION;
    this.playbackController.stop();
    this.library.select(null);
  };

  private async handleScenarioSelected(e: CustomEvent) {
    const id: string = e.detail.id;
    this.sketch = null;
    this.errorPointer = null;
    this.pinnedErrors = [];
    this.selectionState = EMPTY_SELECTION;
    this.railOpen = false;
    this.playbackController.stop();
    await this.library.select(id);
    const entry = this.library.active?.entry;
    if (!entry) return;
    this.viewMode = entry.hasTab ? 'both' : 'notation';
    if (entry.invalidByDesign) {
      this.pinnedErrors = await resolvePinnedErrors(
        this.library.active?.mnxJson,
        entry.meta.expect.errors ?? []
      );
    }
  }

  private handleFilterChanged(e: CustomEvent) {
    const d = e.detail;
    if (d.status !== undefined) this.library.setStatus(d.status);
    if (d.query !== undefined) this.library.setQuery(d.query);
    if (d.idRefsOnly !== undefined) this.library.idRefsOnly = d.idRefsOnly;
    if (d.facet !== undefined) this.library.setFacet(d.facet);
    this.requestUpdate();
  }

  private handleDefFacet(e: CustomEvent) {
    this.library.shelveByDef(e.detail.def);
    this.railOpen = true;
  }

  // ── theming / keyboard ──

  private toggleTheme = () => {
    const resolved = this.getAttribute('resolved-theme');
    this.theme = resolved === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mnx-theme', this.theme);
  };

  private handleKeydown(e: KeyboardEvent) {
    const target = e.composedPath()[0] as HTMLElement;
    const tag = (target?.tagName ?? '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === '/') {
      e.preventDefault();
      this.headerSearch?.focus();
      return;
    }
    if (e.key === 'Escape') {
      if (this.assistOpen) this.assistOpen = false;
      else {
        this.selectionState = EMPTY_SELECTION;
        this.errorPointer = null;
      }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'j', 'k'].includes(e.key)) {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1;
      const next = this.library.step(dir);
      if (next) {
        this.handleScenarioSelected(
          new CustomEvent('scenario-selected', { detail: { id: next } })
        );
      }
    }
  }

  // ── playback ──

  private handlePlayToggle() {
    if (this.playbackController.isPlaying) {
      this.playbackController.stop();
    } else if (this.documentState) {
      this.playbackController.play(this.documentState.mnxJson);
    }
  }

  // ── selection / cross-highlight ──

  private handleNoteSelect(e: CustomEvent) {
    const { noteId, measureIdx, noteIdx } = e.detail;
    this.errorPointer = null;
    if (this.selectionState.selectedNoteIds.includes(noteId)) {
      this.selectionState = EMPTY_SELECTION;
    } else {
      this.selectionState = {
        activePartId: this.documentState?.mnxJson?.parts?.[0]?.id ?? null,
        activeMeasureIndex: measureIdx,
        activeVoiceIndex: 0,
        activeEventIndex: noteIdx,
        selectedNoteIds: [noteId]
      };
      // The renderer-proving gesture costs one click: selecting a note opens
      // the document beside it (DIRECTION.md §3).
      this.showDocumentPane = true;
    }
  }

  private handleDocumentLine(e: CustomEvent) {
    const key: string = e.detail.key;
    this.errorPointer = null;
    this.selectionState = this.selectionState.selectedNoteIds.includes(key)
      ? EMPTY_SELECTION
      : { ...EMPTY_SELECTION, selectedNoteIds: [key] };
  }

  private handleErrorRow(e: CustomEvent) {
    this.errorPointer = e.detail.pointer;
    this.selectionState = EMPTY_SELECTION;
    this.showDocumentPane = true;
  }

  private async handleCopyScoreJson() {
    if (!this.documentState) return;
    await navigator.clipboard.writeText(JSON.stringify(this.documentState.mnxJson, null, 2));
  }

  // ── sketch / assist ──

  private get drawer(): AssistDrawer | null {
    return this.shadowRoot?.querySelector('mnx-assist-drawer') ?? null;
  }

  private async handleFork() {
    const active = this.library.active;
    if (!active) return;
    this.sketch = {
      base: active.entry,
      mnxJson: JSON.parse(JSON.stringify(active.mnxJson))
    };
    this.selectionState = EMPTY_SELECTION;
    this.playbackController.stop();
    await this.updateComplete;
    this.drawer?.chatPanel?.appendMessage(
      'assistant',
      `Forked ${active.entry.id} into a transient sketch. The corpus scenario is untouched. ` +
        'Tell me an edit — I modify the document, and notation, tab, and JSON all re-derive from it.'
    );
  }

  private discardSketch = () => {
    this.sketch = null;
    this.playbackController.stop();
    this.selectionState = EMPTY_SELECTION;
  };

  private async handleChatCommand(e: CustomEvent) {
    const { prompt, model, attachedImages = [] } = e.detail;
    // Chat only ever edits a sketch — the corpus invariant.
    if (!this.sketch || !this.documentState) return;

    const chatPanel = this.drawer?.chatPanel as any;
    if (chatPanel) {
      chatPanel.isProcessing = true;
      chatPanel.tokensCount = 0;
      chatPanel.statusMessage = '';
    }

    try {
      const response = await fetch('/api/edit-notation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: prompt,
          mnxJson: this.documentState.mnxJson,
          selectionContext: {
            activePartId: this.selectionState.activePartId,
            activeMeasureIndex: this.selectionState.activeMeasureIndex,
            activeVoiceIndex: this.selectionState.activeVoiceIndex,
            activeEventIndex: this.selectionState.activeEventIndex,
            selectedNoteIds: this.selectionState.selectedNoteIds,
            playerPlayheadTime: this.playbackController.playheadBeat
          },
          model,
          attachedImages
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';
      let doneData: any = null;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const chunk = JSON.parse(trimmed);
              if (chunk.type === 'progress') {
                if (chatPanel) {
                  chatPanel.tokensCount = chunk.tokens;
                  if (chunk.status !== undefined) {
                    chatPanel.statusMessage = chunk.status;
                  }
                }
              } else if (chunk.type === 'done') {
                doneData = chunk;
              }
            } catch (err) {
              console.error('Failed to parse NDJSON line:', trimmed, err);
            }
          }
        }
      }

      if (chatPanel && doneData) {
        chatPanel.appendTranscript({
          timestamp: Date.now(),
          userPrompt: prompt,
          model,
          mockMode: doneData.mockMode === true,
          success: doneData.success,
          attemptsUsed: doneData.attemptsUsed ?? null,
          messages: doneData.messages ?? null,
          toolCallArguments: doneData.toolCallArguments ?? null,
          assistantContent: doneData.assistantContent ?? null,
          explanation: doneData.explanation ?? null,
          error: doneData.error ?? null,
          updatedMnxJson: doneData.updatedMnxJson ?? null
        });
      }

      const modelSaid = (doneData?.assistantContent || '').trim();
      const noEdits = doneData?.explanation === 'Completed instruction (no edits made).';

      if (doneData && doneData.success && doneData.updatedMnxJson && !noEdits) {
        // Apply to the sketch only; everything re-derives from the document.
        if (this.sketch) {
          this.sketch = { ...this.sketch, mnxJson: doneData.updatedMnxJson };
        }
        if (chatPanel) {
          const parts: string[] = [];
          if (modelSaid) parts.push(modelSaid);
          parts.push(doneData.explanation || 'Sketch updated.');
          chatPanel.appendMessage('assistant', parts.join('\n\n'));
        }
      } else if (doneData && doneData.success && noEdits) {
        // Model went through cleanly but emitted no tool call — usually because
        // it refused, spoke instead of tool-calling, or (with image input) the
        // model wasn't actually multimodal.
        if (chatPanel) {
          const msg = modelSaid
            ? `Model didn't edit the sketch. It said:\n\n${modelSaid}`
            : 'Model returned no tool call and no text. This usually means the selected model declined to call the edit tool — try a different model, especially if you attached an image to a non-vision model.';
          chatPanel.appendMessage('assistant', msg);
        }
      } else {
        const errMsg = doneData?.error || 'Failed to modify notation.';
        if (chatPanel) {
          const fullMsg = modelSaid
            ? `Error: ${errMsg}\n\nModel said:\n${modelSaid}`
            : 'Error: ' + errMsg;
          chatPanel.appendMessage('assistant', fullMsg);
        }
      }
    } catch (err: any) {
      if (chatPanel) {
        chatPanel.appendMessage('assistant', 'Network Error: ' + err.message);
      }
    } finally {
      if (chatPanel) {
        chatPanel.isProcessing = false;
      }
    }
  }
}

export default MnxEditorApp;
