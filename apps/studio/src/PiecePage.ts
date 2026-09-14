// #/piece/<id> — one piece, fullscreen. Fetches the canonical FILE through the
// library's read route (a .gp for a Soundslice piece), converts it in the
// importers' clean-room worker — the service stores the source, the reader
// converts — and mounts it in the score frame: <mnx-document-viewer> filling
// the pane, <mnx-player> in the frame's bottom grip, wired through the
// plain-DOM host binding the embed face exports. Nothing here edits or
// persists anything except per-browser preferences (the staff view, the
// display settings, zoom and spacing — the one persistence a shell may own
// without a backend decision).
//
// The chrome is the frame's (roadmap/inprogress/core-score-frame.md): a title
// grip and a playback grip on the pane's edges, drawn out into the library page's
// tools row and the player's tray. This page supplies what the frame prints
// and stores what it changes. Trimmed 2026-09-13: the tools row carries the way
// back, the title, Zoom, Settings, Tags and the theme toggle — the tag chips
// went (the Tags sheet shows them), the staff view lives in Settings alone,
// and the account menu is the library page's (a piece is not where you sign
// out). Recordings moved to the player's tray, beside the source switcher whose
// sources they are.
import { LitElement, css, html, nothing } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { customElement, property, query, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError, type LibrarySnapshot } from '../../../src/storage/libraryClient.ts';
import { documentTitle, documentArtist, type MnxDocument } from '../../../src/model/mnx.ts';
import { normalizeDisplayOptions, type DisplayOptions } from '../../../src/engine/displayOptions.ts';
import type { RenderScale } from '../../../src/engine/render/scale.ts';
import { openLocalFile } from '../../../src/importers/localFile.ts';
import { bindPlayback } from '../../../src/elements/playbackHost.ts';
import { DEFAULT_DISPLAY_PREFERENCES } from '../../../src/elements/displayDefaults.ts';
import type { DocumentViewer, ViewMode, ViewSetting } from '../../../src/elements/DocumentViewer.ts';
import type { RecordingSource } from '../../../src/audio/playbackBackend.ts';
import type { Player } from '../../../src/elements/Player.ts';
import type { StripChange } from '../../../src/elements/ScoreFrame.ts';
import type { ZoomPadChange } from '../../../src/elements/ZoomPad.ts';
import { libraryReturnHref, returnToLibrary } from './StudioApp.ts';
import { nextTheme, readTheme, resolvedTheme, setTheme, themeGlyph, type ThemeSetting } from './theme.ts';
import './TagsSheet.ts';
import './RecordingsSheet.ts';
import type { TagsSnapshot } from './TagsSheet.ts';

import { VIEW_KEY, DISPLAY_KEY, UNROLLED_KEY, STAFF_SCALE_KEY, DENSITY_H_KEY, SPACING_MODE_KEY, TOOLS_OPEN_KEY, PLAYER_OPEN_KEY, read, write, readView, readDisplay, readNumber } from './scorePreferences.ts';

const back = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"></path></svg>`;
/** The recordings sheet's mark in the tray: an info ring beside the source switcher. */
const infoGlyph = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none"></circle></svg>`;
const tagGlyph = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"></path><circle cx="7.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"></circle></svg>`;

@customElement('mnx-studio-piece')
export class PiecePage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @property({ type: String }) pieceId = '';
  @state() private snapshot: LibrarySnapshot | null = null;
  @state() private recordings: readonly RecordingSource[] = [];
  @state() private doc: MnxDocument | null = null;
  @state() private error = '';
  @state() private loading = true;
  @state() private tagsOpen = false;
  @state() private recordingsOpen = false;
  @state() private selectedRecordingId: string | null = null;
  @state() private addingRecording = false;
  @state() private recordingWarning: { id: string; message: string } | null = null;
  @state() private theme: ThemeSetting = readTheme();
  @state() private view: ViewSetting = readView();
  @state() private display: DisplayOptions = readDisplay();
  @state() private unrolled = read(UNROLLED_KEY) === 'true';
  @state() private staffScale: number | null = readNumber(STAFF_SCALE_KEY);
  @state() private densityH: number | null = readNumber(DENSITY_H_KEY);
  @state() private spacingMode: 'natural' | 'fill' = read(SPACING_MODE_KEY) === 'natural' ? 'natural' : 'fill';
  @state() private effectiveStaffScale = 1;
  /** The frame's strips as the reader last left them — a per-browser preference. */
  @state() private toolsOpen = read(TOOLS_OPEN_KEY) === 'true';
  @state() private playerOpen = read(PLAYER_OPEN_KEY) === 'true';
  @query('mnx-document-viewer') private viewer!: DocumentViewer;
  @query('mnx-player') private player!: Player;
  private binding: ReturnType<typeof bindPlayback> | null = null;
  private generation = 0;

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    mnx-score-frame {
      height: 100%;
    }
    mnx-document-viewer {
      display: block;
      min-height: 100%;
    }
    mnx-document-viewer[hidden] {
      display: none;
    }
    mnx-studio-tags, mnx-studio-recordings {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 6;
    }
    .notice {
      max-width: 36rem;
      margin: 20vh auto 0;
      padding: 0 24px;
      color: var(--ink-dim);
    }
    .notice h1 {
      font-size: 1.4rem;
      color: var(--ink);
      margin: 0 0 12px;
    }
    .notice a {
      color: inherit;
    }
    /* The theme toggle: a word and a mark, at the end of the tools row. The
       word is part of the control — three settings cannot be read off an
       icon, and auto has to say which way it currently resolves. */
    .theme span {
      text-transform: capitalize;
    }
  `;

  private cycleTheme() {
    this.theme = nextTheme(this.theme);
    setTheme(this.theme);
  }

  disconnectedCallback() {
    ++this.generation;
    this.binding?.dispose();
    this.binding = null;
    super.disconnectedCallback();
  }

  // The viewer and the player are always in the DOM (the viewer hidden until a
  // document arrives) so the binding is made once and survives piece-to-piece
  // navigation.
  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('pieceId')) void this.load();
    let fresh = false;
    if (!this.binding && this.player && this.viewer) {
      this.binding = bindPlayback(this, this.viewer, this.player);
      fresh = true;
    }
    if (this.binding && this.doc && (fresh || changed.has('doc'))) this.present(this.doc);
  }

  private async load() {
    const generation = ++this.generation;
    this.binding?.dispose(); this.binding = null;
    this.player?.stop();
    if (this.player) this.player.performance = null;
    this.recordings = []; this.snapshot = null;
    this.doc = null;
    this.error = '';
    this.loading = true;
    this.tagsOpen = false; this.recordingsOpen = false; this.selectedRecordingId = null; this.addingRecording = false;
    try {
      const readPair = () => Promise.all([
        this.client.canonical(this.pieceId),
        this.client.piece(this.pieceId).then(r => r.snapshot, () => null),
      ]);
      let [canonical, snapshot] = await readPair();
      const mismatched = () => snapshot && canonical.renditionId !== undefined && canonical.renditionId !== snapshot.piece.canonical_rendition_id;
      // Immutable rendition identity pairs the file with its metadata even when
      // the canonical pointer changes between the two parallel reads.
      for (let attempt = 0; mismatched() && attempt < 2; attempt++) [canonical, snapshot] = await readPair();
      if (mismatched()) throw new Error('The score changed while opening. Reopen the piece to review its current timings.');
      const { bytes, filename } = canonical;
      if (generation !== this.generation) return;
      this.snapshot = snapshot;
      this.setRecordings(snapshot);
      // The library remembers what was opened; the recent sort reads it. Never blocking.
      void this.client.opened(this.pieceId).catch(() => {});
      const opened = await openLocalFile(new File([bytes], filename));
      if (generation !== this.generation) return;
      const mnxJson = opened.document;
      this.doc = {
        id: `library:${this.pieceId}`,
        name: this.tag('title') ?? documentTitle(mnxJson) ?? opened.name,
        lastUpdated: Date.now(),
        mnxJson,
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.error = error instanceof Error ? error.message : 'The library is unavailable.';
      if (error instanceof LibraryRequestError && error.status === 403) location.hash = '#/not-permitted';
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  /** Hand the document to the viewer and the player through one binding. The
   *  viewer resolves the view, and the views it can offer, from the document
   *  it now has — so the frame is rendered once more to ask it. */
  private present(doc: MnxDocument) {
    const result = this.binding!.setDocument(doc);
    if (!result.ok) this.error = 'This piece has no playable performance; the score still shows.';
    this.requestUpdate();
  }

  private tag(dimension: string): string | null {
    return this.snapshot?.tags.find(t => t.dimension === dimension)?.shown ?? null;
  }

  private setRecordings(snapshot: LibrarySnapshot | null) {
    const recordings: RecordingSource[] = (snapshot?.recordings ?? []).filter(r => r.kind === 'audio' || (r.kind === 'youtube' && r.external_id)).map(r => {
      let syncpoints: unknown = null;
      try { syncpoints = r.syncpoints === null ? null : JSON.parse(r.syncpoints); } catch { syncpoints = r.syncpoints; }
      return r.kind === 'youtube' ? { kind: 'youtube', id: r.id, name: r.name || 'YouTube recording', video: r.external_id!, syncpoints } : { kind: 'audio', id: r.id, name: r.name || 'Audio recording', media: this.client.recordingUrl(r.id), syncpoints };
    });
    if (JSON.stringify(recordings) !== JSON.stringify(this.recordings)) this.recordings = recordings;
  }
  private async refreshSnapshot() {
    const generation = this.generation;
    try {
      const snapshot = (await this.client.piece(this.pieceId)).snapshot;
      if (generation !== this.generation) return;
      if (this.snapshot?.piece.canonical_rendition_id !== snapshot.piece.canonical_rendition_id) { await this.load(); return; }
      this.player?.pause(); this.snapshot = snapshot; this.setRecordings(snapshot);
    } catch { /* keep what we have */ }
  }

  // ── what the frame changes, stored per browser ──────────────────────────

  private onViewChange(event: CustomEvent<ViewMode>) {
    this.view = event.detail;
    write(VIEW_KEY, this.view);
  }
  private setDisplay(next: DisplayOptions) {
    const { selectedVerse: _transient, ...validated } = normalizeDisplayOptions(next);
    this.display = { ...DEFAULT_DISPLAY_PREFERENCES, ...validated };
    write(DISPLAY_KEY, JSON.stringify(this.display));
  }
  private onDisplayChange(event: CustomEvent<DisplayOptions>) {
    this.setDisplay(event.detail);
  }
  private onStripChange(event: CustomEvent<StripChange>) {
    const { strip, open } = event.detail;
    if (strip === 'top') {
      this.toolsOpen = open;
      write(TOOLS_OPEN_KEY, String(open));
    } else {
      this.playerOpen = open;
      write(PLAYER_OPEN_KEY, String(open));
    }
  }

  private onUnrolledChange(event: CustomEvent<boolean>) {
    this.unrolled = event.detail;
    write(UNROLLED_KEY, String(this.unrolled));
  }
  private onZoomChange(event: CustomEvent<ZoomPadChange>) {
    const { staffScale, densityH } = event.detail;
    this.staffScale = staffScale;
    this.densityH = densityH;
    // Absence is the "unset" state, so reset REMOVES rather than writing a
    // sentinel — otherwise the next load could not tell "fitted" from "1.0".
    write(STAFF_SCALE_KEY, staffScale === null ? null : String(staffScale));
    write(DENSITY_H_KEY, densityH === null ? null : String(densityH));
  }
  private onSpacingModeChange(event: CustomEvent<'natural' | 'fill'>) {
    this.spacingMode = event.detail;
    write(SPACING_MODE_KEY, this.spacingMode);
  }
  private onClearanceChange(event: CustomEvent<number>) {
    this.setDisplay({ ...this.display, clearance: event.detail });
  }
  private readonly densitySteps = () => this.viewer?.densitySteps() ?? null;

  render() {
    const title = this.doc ? (this.tag('title') ?? this.doc.name) : '';
    const artist = this.doc ? (this.tag('artist') ?? documentArtist(this.doc.mnxJson) ?? '') : '';
    const selectedRecording = this.snapshot?.recordings.find(r => r.id === this.selectedRecordingId);
    const themeNext = nextTheme(this.theme);
    const themeSentence = `Theme: ${this.theme}${this.theme === 'auto' ? ` (now ${resolvedTheme(this.theme)})` : ''} — click for ${themeNext}`;
    // The viewer is queried, not stored: before the first render there is none.
    const viewer = this.viewer as DocumentViewer | null;
    return html`
      <mnx-score-frame
        .heading=${title}
        .subheading=${artist}
        .view=${viewer?.resolvedView() ?? 'notation'}
        .views=${viewer?.availableViews() ?? ['notation']}
        .display=${this.display}
        .unrolled=${this.unrolled}
        .staffScale=${this.staffScale}
        .densityH=${this.densityH}
        .spacingMode=${this.spacingMode}
        .clearance=${this.display.clearance ?? 2}
        .effectiveStaffScale=${this.effectiveStaffScale}
        .densitySteps=${this.densitySteps}
        .pads=${!!this.doc}
        .staffView=${false}
        .topOpen=${this.toolsOpen}
        .bottomOpen=${this.playerOpen}
        @strip-change=${this.onStripChange}
        @view-change=${this.onViewChange}
        @display-change=${this.onDisplayChange}
        @unrolled-change=${this.onUnrolledChange}
        @zoom-change=${this.onZoomChange}
        @spacing-mode-change=${this.onSpacingModeChange}
        @clearance-change=${this.onClearanceChange}
      >
        <a slot="back" href=${libraryReturnHref()} @click=${returnToLibrary}>${back}<span>Library</span></a>
        ${this.doc
          ? html`<button slot="actions" type="button" aria-pressed=${this.tagsOpen} @click=${() => { this.tagsOpen = !this.tagsOpen; this.recordingsOpen = false; }}>
              ${tagGlyph}<span>Tags · ${this.snapshot?.tags.length ?? 0}</span>
            </button>`
          : nothing}
        <button slot="menu" class="theme" type="button" title=${themeSentence} aria-label=${themeSentence} @click=${this.cycleTheme}>
          ${themeGlyph(this.theme)}<span>${this.theme}</span>
        </button>

        ${this.loading ? html`<p class="notice" role="status">Loading…</p>` : nothing}
        ${!this.loading && !this.doc
          ? html`<div class="notice">
              <h1>Could not open this piece</h1>
              <p role="alert">${this.error}</p>
              <p><a href=${libraryReturnHref()} @click=${returnToLibrary}>Back to the library</a></p>
            </div>`
          : nothing}
        ${this.doc && this.error ? html`<p class="notice" role="alert">${this.error}</p>` : nothing}
        <mnx-document-viewer
          ?hidden=${!this.doc}
          .view=${this.view}
          .unrolled=${this.unrolled}
          .lyrics=${this.display.lyrics}
          .timeSignatures=${this.display.timeSignatures}
          .clefs=${this.display.clefs}
          .scoreTitle=${this.display.title}
          .barNumbers=${this.display.barNumbers}
          .instrumentNames=${this.display.instrumentNames}
          .beams=${this.display.beams}
          .clearance=${this.display.clearance ?? 2}
          .zoom=${this.staffScale}
          .densityH=${this.densityH}
          .spacingMode=${this.spacingMode}
          @render-scale=${(e: CustomEvent<RenderScale>) => (this.effectiveStaffScale = e.detail.staffScale)}
        ></mnx-document-viewer>
        <mnx-player slot="player" .recordings=${this.recordings} .canAddRecording=${!!this.snapshot} .syncWarningsInPanel=${true}
          @playback-position=${(e: CustomEvent<{ sourceId?: string; syncWarning?: string }>) => {
            const { sourceId, syncWarning } = e.detail;
            if (this.recordingWarning?.id === sourceId && this.recordingWarning?.message === syncWarning) return;
            this.recordingWarning = sourceId && syncWarning ? { id: sourceId, message: syncWarning } : null;
          }}
          @source-selected=${(e: CustomEvent<{ id: string }>) => {
            this.selectedRecordingId = e.detail.id === 'synth' ? null : e.detail.id;
            this.addingRecording = false;
            if (!this.selectedRecordingId) this.recordingsOpen = false;
          }}
          @add-recording=${() => { this.player?.pause(); this.addingRecording = true; this.recordingsOpen = true; this.tagsOpen = false; void this.refreshSnapshot(); }}>
          ${selectedRecording
            ? html`<button slot="source-tools" type="button" aria-pressed=${this.recordingsOpen}
                title="Recording details" aria-label=${`Recording details: ${selectedRecording.name ?? 'Unnamed recording'}`}
                @click=${async () => { const generation = this.generation; this.player?.pause(); await this.refreshSnapshot(); if (generation !== this.generation) return; this.recordingsOpen = !this.recordingsOpen || this.addingRecording; this.addingRecording = false; this.tagsOpen = false; }}>${infoGlyph}</button>`
            : nothing}
        </mnx-player>
      </mnx-score-frame>
      ${this.recordingsOpen && this.snapshot && this.doc ? keyed(this.addingRecording ? 'new' : this.selectedRecordingId, html`<mnx-studio-recordings .syncWarning=${!this.addingRecording && this.recordingWarning?.id === this.selectedRecordingId ? this.recordingWarning.message : ''} .recordingId=${this.addingRecording ? null : this.selectedRecordingId} .client=${this.client} .snapshot=${this.snapshot} .document=${this.doc}
        @recordings-changed=${async (e: CustomEvent<LibrarySnapshot>) => { this.player?.pause(); if (this.snapshot?.piece.canonical_rendition_id !== e.detail.piece.canonical_rendition_id) { await this.load(); return; } this.snapshot = { ...e.detail, tags: this.snapshot?.tags ?? [] }; this.setRecordings(e.detail); }}
        @recording-saved=${async (e: CustomEvent<{ id: string }>) => { if (!this.snapshot?.recordings.some(r => r.id === e.detail.id)) return; this.addingRecording = false; this.selectedRecordingId = e.detail.id; await this.updateComplete; await this.player?.updateComplete; await this.player?.selectSource(e.detail.id); }}
        @recording-deleted=${() => { this.recordingsOpen = false; this.selectedRecordingId = null; this.addingRecording = false; void this.player?.selectSource('synth'); }}
        @close=${() => this.recordingsOpen = false}></mnx-studio-recordings>`) : nothing}
      ${this.tagsOpen ? html`<mnx-studio-tags .client=${this.client} .snapshot=${this.snapshot}
        @tags-changed=${(e: CustomEvent<TagsSnapshot>) => { if (this.snapshot) this.snapshot = { ...this.snapshot, ...e.detail, piece: { ...this.snapshot.piece, ...e.detail.piece } }; void this.refreshSnapshot(); }}
        @aliases-changed=${() => this.refreshSnapshot()}
        @close=${() => (this.tagsOpen = false)}></mnx-studio-tags>` : nothing}
    `;
  }
}
