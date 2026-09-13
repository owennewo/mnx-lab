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
// and stores what it changes.
import { LitElement, css, html, nothing } from 'lit';
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
import { libraryHref } from './StudioApp.ts';
import { chipText, dimensionLabel } from './labels.ts';
import './TagsSheet.ts';
import './RecordingsSheet.ts';
import type { TagsSnapshot } from './TagsSheet.ts';

import { VIEW_KEY, DISPLAY_KEY, UNROLLED_KEY, STAFF_SCALE_KEY, DENSITY_H_KEY, SPACING_MODE_KEY, TOOLS_OPEN_KEY, PLAYER_OPEN_KEY, read, write, readView, readDisplay, readNumber } from './scorePreferences.ts';

const CHIP_DIMENSIONS = ['tuning-name', 'capo', 'key', 'genre', 'list'];

const back = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"></path></svg>`;
const more = html`<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.8" fill="currentColor"></circle><circle cx="12" cy="12" r="1.8" fill="currentColor"></circle><circle cx="18" cy="12" r="1.8" fill="currentColor"></circle></svg>`;
const tagGlyph = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"></path><circle cx="7.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"></circle></svg>`;

@customElement('mnx-studio-piece')
export class PiecePage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @property({ type: String }) pieceId = '';
  /** The signed-in address, for the menu; sign-out is Access's own logout. */
  @property({ type: String }) email = '';
  @state() private snapshot: LibrarySnapshot | null = null;
  @state() private recordings: readonly RecordingSource[] = [];
  @state() private doc: MnxDocument | null = null;
  @state() private error = '';
  @state() private loading = true;
  @state() private tagsOpen = false;
  @state() private recordingsOpen = false;
  @state() private menuOpen = false;
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
    /* The chips row: the library page's chip, read-only here. */
    .chips {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 30px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 3px;
      background: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60));
      font-size: 13px;
      white-space: nowrap;
    }
    .chip .dim {
      color: var(--ink-dim);
    }
    /* The menu: the signed-in address and the way out, under the … button. */
    .menu {
      position: relative;
    }
    .menu > div {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 6;
      min-width: 220px;
      padding: 6px;
      background: light-dark(oklch(0.985 0.002 60), oklch(0.22 0.004 60));
      border: 1px solid var(--line);
      border-radius: 3px;
      box-shadow: 0 1px 2px rgba(0 0 0 / 0.1), 0 3px 10px rgba(0 0 0 / 0.12);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .menu .who {
      padding: 8px 10px;
      color: var(--ink-dim);
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .menu > div button {
      height: 40px;
      text-align: left;
      padding: 0 10px;
      border: 0;
      border-radius: 3px;
      background: transparent;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .menu > div button:hover {
      background: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60));
    }
  `;

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
    this.tagsOpen = false; this.recordingsOpen = false;
    this.menuOpen = false;
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
    const chips = (this.snapshot?.tags ?? []).filter(t => CHIP_DIMENSIONS.includes(t.dimension)).slice(0, 4);
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
        <a slot="back" href=${libraryHref}>${back}<span>Library</span></a>
        ${chips.length
          ? html`<div slot="chips" class="chips">
              ${chips.map(t => html`<span class="chip"><span class="dim">${dimensionLabel(t.dimension).toLowerCase()}</span><span>${chipText(t.dimension, t.shown)}</span></span>`)}
            </div>`
          : nothing}
        ${this.doc
          ? html`<button slot="actions" type="button" aria-pressed=${this.tagsOpen} @click=${() => (this.tagsOpen = !this.tagsOpen)}>
              ${tagGlyph}<span>Tags · ${this.snapshot?.tags.length ?? 0}</span>
            </button>`
          : nothing}
        ${this.doc ? html`<button slot="actions" type="button" aria-pressed=${this.recordingsOpen} @click=${async () => { this.player?.pause(); await this.refreshSnapshot(); this.recordingsOpen = !this.recordingsOpen; this.tagsOpen = false; }}>Recordings · ${this.snapshot?.recordings.length ?? 0}</button>` : nothing}
        <div slot="menu" class="menu">
          <button type="button" aria-label="More" aria-expanded=${this.menuOpen} @click=${() => (this.menuOpen = !this.menuOpen)}>${more}</button>
          ${this.menuOpen
            ? html`<div>
                ${this.email ? html`<span class="who">${this.email}</span>` : nothing}
                <button type="button" @click=${() => this.client.signOut()}>Sign out</button>
              </div>`
            : nothing}
        </div>

        ${this.loading ? html`<p class="notice" role="status">Loading…</p>` : nothing}
        ${!this.loading && !this.doc
          ? html`<div class="notice">
              <h1>Could not open this piece</h1>
              <p role="alert">${this.error}</p>
              <p><a href=${libraryHref}>Back to the library</a></p>
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
        <mnx-player slot="player" .recordings=${this.recordings}></mnx-player>
      </mnx-score-frame>
      ${this.recordingsOpen && this.snapshot && this.doc ? html`<mnx-studio-recordings .client=${this.client} .snapshot=${this.snapshot} .document=${this.doc}
        @recordings-changed=${async (e: CustomEvent<LibrarySnapshot>) => { this.player?.pause(); if (this.snapshot?.piece.canonical_rendition_id !== e.detail.piece.canonical_rendition_id) { await this.load(); return; } this.snapshot = { ...e.detail, tags: this.snapshot?.tags ?? [] }; this.setRecordings(e.detail); await this.refreshSnapshot(); }}
        @close=${() => this.recordingsOpen = false}></mnx-studio-recordings>` : nothing}
      ${this.tagsOpen ? html`<mnx-studio-tags .client=${this.client} .snapshot=${this.snapshot}
        @tags-changed=${(e: CustomEvent<TagsSnapshot>) => { if (this.snapshot) this.snapshot = { ...this.snapshot, ...e.detail, piece: { ...this.snapshot.piece, ...e.detail.piece } }; void this.refreshSnapshot(); }}
        @aliases-changed=${() => this.refreshSnapshot()}
        @close=${() => (this.tagsOpen = false)}></mnx-studio-tags>` : nothing}
    `;
  }
}
