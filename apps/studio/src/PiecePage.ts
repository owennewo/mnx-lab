// #/piece/<id> — one piece, fullscreen. Fetches the canonical FILE through the
// library's read route (a .gp for a Soundslice piece), converts it in the
// importers' clean-room worker — the service stores the source, the reader
// converts — and mounts it in the score frame: <mnx-document-viewer> filling
// the pane, <mnx-player> in the frame's bottom strip, wired through the
// plain-DOM host binding the embed face exports. Nothing here edits or
// persists anything except per-browser preferences (the staff view, the
// display settings, zoom and spacing — the one persistence a shell may own
// without a backend decision).
//
// The chrome is the frame's (roadmap/inprogress/core-score-frame.md): the
// library page's tools row above the score and the player's tray below, hidden
// and shown together by the focus mark on the pane's corner (one toggle since
// 2026-09-15; the edge grips went). This page supplies what the frame prints
// and stores what it changes. Trimmed 2026-09-13: the tools row carries the way
// back, the title, Zoom, Settings, Tags and the theme toggle — the tag chips
// went (the Tags sheet shows them), the staff view lives in Settings alone,
// and the account menu is the library page's (a piece is not where you sign
// out). 2026-09-14: what plays left the tray for the tools row — a Source
// button that names it, opening the Source sheet (choose, edit, add) in the
// frame's side slot beside Instruments; the recording editor opens there too.
import { LitElement, css, html, nothing } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { customElement, property, query, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError, type LibrarySnapshot } from '../../../src/storage/libraryClient.ts';
import { documentTitle, documentArtist, type MnxDocument } from '../../../src/model/mnx.ts';
import { type DisplayOptions } from '../../../src/engine/displayOptions.ts';
import type { RenderScale } from '../../../src/engine/render/scale.ts';
import { openLocalFile } from '../../../src/importers/localFile.ts';
import { bindPlayback } from '../../../src/elements/playbackHost.ts';
import { normalizeDisplayPreferences } from '../../../src/elements/displayDefaults.ts';
import type { DocumentViewer, ViewMode, ViewSetting } from '../../../src/elements/DocumentViewer.ts';
import type { RecordingSource } from '../../../src/audio/playbackBackend.ts';
import type { Player } from '../../../src/elements/Player.ts';
import type { ZoomPadChange } from '../../../src/elements/ZoomPad.ts';
import { libraryReturnHref, returnToLibrary } from './StudioApp.ts';
import { nextTheme, readTheme, resolvedTheme, setTheme, themeGlyph, type ThemeSetting } from './theme.ts';
import { isKitPart, type PartMix } from '../../../src/audio/partMix.ts';
import './TagsSheet.ts';
import './RecordingsSheet.ts';
import './InstrumentsSheet.ts';
import { sourceGlyph } from './SourceSheet.ts';
import type { TagsSnapshot } from './TagsSheet.ts';
import type { InstrumentPart } from './InstrumentsSheet.ts';

import { VIEW_KEY, DISPLAY_KEY, UNROLLED_KEY, STAFF_SCALE_KEY, DENSITY_H_KEY, SPACING_MODE_KEY, FOCUSED_KEY, read, write, readView, readDisplay, readNumber, readFocused, readParts, writeParts } from './scorePreferences.ts';

const back = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"></path></svg>`;
/** Instruments: three faders, each knob at its own level. */
const mixerGlyph = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v5M6 13v7M12 4v11M12 19v1M18 4v1M18 9v11"></path><circle cx="6" cy="11" r="2"></circle><circle cx="12" cy="17" r="2"></circle><circle cx="18" cy="7" r="2"></circle></svg>`;
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
  /** The recording editor (edit or add), in the side slot. */
  @state() private recordingsOpen = false;
  @state() private sourceOpen = false;
  @state() private instrumentsOpen = false;
  /** The recording the editor shows — not necessarily the one playing. */
  @state() private editingRecordingId: string | null = null;
  /** The piece's parts as the reader left them: off the score, and the mix. */
  @state() private hiddenParts: readonly number[] = [];
  @state() private partMix: PartMix = {};
  /** What is playing — a recording has no parts to mix. */
  @state() private playbackKind: string | undefined;
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
  /** Whether the reader left the score focused (the frame's strips hidden) — a per-browser preference. */
  @state() private focused = readFocused();
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
    mnx-studio-tags {
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
    this.tagsOpen = false; this.recordingsOpen = false; this.sourceOpen = false; this.selectedRecordingId = null; this.editingRecordingId = null; this.addingRecording = false;
    ({ hidden: this.hiddenParts, mix: this.partMix } = readParts(this.pieceId));
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
    // A document without a performance needs no notice: the player's readout
    // already says so, and the score shows either way.
    this.binding!.setDocument(doc);
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
    this.display = normalizeDisplayPreferences(next);
    write(DISPLAY_KEY, JSON.stringify(this.display));
  }
  private onDisplayChange(event: CustomEvent<DisplayOptions>) {
    this.setDisplay(event.detail);
  }
  private onFocusChange(event: CustomEvent<boolean>) {
    this.focused = event.detail;
    write(FOCUSED_KEY, String(this.focused));
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
  private readonly densitySteps = () => this.viewer?.densitySteps() ?? null;

  // ── the side panels: one at a time ──────────────────────────────────────

  private openPanel(which: 'tags' | 'source' | 'instruments' | 'recording' | null) {
    this.tagsOpen = which === 'tags';
    this.sourceOpen = which === 'source';
    this.instrumentsOpen = which === 'instruments';
    this.recordingsOpen = which === 'recording';
  }
  /** The editor on one recording, read fresh so its revision is current. */
  private async editRecording(id: string) {
    const generation = this.generation;
    this.player?.pause();
    await this.refreshSnapshot();
    if (generation !== this.generation) return;
    this.addingRecording = false;
    this.editingRecordingId = id;
    this.openPanel('recording');
  }
  private addRecording() {
    this.player?.pause();
    this.addingRecording = true;
    this.editingRecordingId = null;
    this.openPanel('recording');
    void this.refreshSnapshot();
  }

  // ── the Instruments sheet ───────────────────────────────────────────────

  private setParts(hidden: readonly number[], mix: PartMix) {
    this.hiddenParts = hidden;
    this.partMix = mix;
    writeParts(this.pieceId, { hidden, mix });
  }
  private instrumentParts(doc: MnxDocument): InstrumentPart[] {
    const performance = this.player?.performance ?? null;
    return doc.mnxJson.parts.map((part, index) => {
      const lab = part._x?.mnxLab;
      const kit = 'kit' in part || (performance ? isKitPart(performance, index) : false);
      const strings = lab?.strings?.length;
      const detail = kit
        ? 'Percussion'
        : [strings ? `${strings} strings` : '', lab?.capo ? `Capo ${lab.capo}` : '', (part.staves ?? 1) > 1 ? `${part.staves} staves` : '']
            .filter(Boolean)
            .join(' · ');
      return { index, name: part.name || `Part ${index + 1}`, detail, kit };
    });
  }

  render() {
    const title = this.doc ? (this.tag('title') ?? this.doc.name) : '';
    const artist = this.doc ? (this.tag('artist') ?? documentArtist(this.doc.mnxJson) ?? '') : '';
    const activeId = this.selectedRecordingId ?? 'synth';
    const activeRecording = this.snapshot?.recordings.find(r => r.id === this.selectedRecordingId);
    const playable = this.snapshot?.recordings.filter(r => this.recordings.some(s => s.id === r.id)) ?? [];
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
        .effectiveStaffScale=${this.effectiveStaffScale}
        .densitySteps=${this.densitySteps}
        .pads=${!!this.doc}
        .staffView=${false}
        .focused=${this.focused}
        @focus-change=${this.onFocusChange}
        @view-change=${this.onViewChange}
        @display-change=${this.onDisplayChange}
        @unrolled-change=${this.onUnrolledChange}
        @zoom-change=${this.onZoomChange}
        @spacing-mode-change=${this.onSpacingModeChange}
      >
        <a slot="back" href=${libraryReturnHref()} @click=${returnToLibrary}>${back}<span>Library</span></a>
        ${this.doc
          ? html`<button slot="actions" type="button" aria-pressed=${this.tagsOpen} @click=${() => this.openPanel(this.tagsOpen ? null : 'tags')}>
              ${tagGlyph}<span>Tags · ${this.snapshot?.tags.length ?? 0}</span>
            </button>
            <button slot="actions" type="button" aria-pressed=${this.sourceOpen || this.recordingsOpen}
              aria-label=${`Source: ${activeRecording?.name ?? 'Synth'}`} @click=${() => this.openPanel(this.sourceOpen ? null : 'source')}>
              ${sourceGlyph(activeRecording ? (activeRecording.kind === 'youtube' ? 'youtube' : 'audio') : 'synth')}<span>Source · ${activeRecording?.name ?? 'Synth'}</span>
            </button>
            <button slot="actions" type="button" aria-pressed=${this.instrumentsOpen} @click=${() => this.openPanel(this.instrumentsOpen ? null : 'instruments')}>
              ${mixerGlyph}<span>Instruments · ${this.doc.mnxJson.parts.length}</span>
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
          .zoom=${this.staffScale}
          .densityH=${this.densityH}
          .spacingMode=${this.spacingMode}
          .hiddenParts=${this.hiddenParts}
          @render-scale=${(e: CustomEvent<RenderScale>) => (this.effectiveStaffScale = e.detail.staffScale)}
        ></mnx-document-viewer>
        <mnx-player slot="player" .recordings=${this.recordings} .syncWarningsInPanel=${true}
          .partMix=${this.partMix} .soundControl=${false} .sourceControl=${false}
          @playback-position=${(e: CustomEvent<{ sourceId?: string; kind?: string; syncWarning?: string }>) => {
            const { sourceId, kind, syncWarning } = e.detail;
            if (kind !== this.playbackKind) this.playbackKind = kind;
            if (this.recordingWarning?.id === sourceId && this.recordingWarning?.message === syncWarning) return;
            this.recordingWarning = sourceId && syncWarning ? { id: sourceId, message: syncWarning } : null;
          }}
          @source-selected=${(e: CustomEvent<{ id: string }>) => {
            this.selectedRecordingId = e.detail.id === 'synth' ? null : e.detail.id;
          }}>
        </mnx-player>
        ${this.sourceOpen && this.doc
          ? html`<mnx-studio-source slot="side"
              .recordings=${playable}
              .document=${this.doc}
              .activeId=${activeId}
              .syncWarning=${this.recordingWarning?.id === activeId ? this.recordingWarning.message : ''}
              .canAdd=${!!this.snapshot}
              @source-choose=${(e: CustomEvent<{ id: string }>) => void this.player?.selectSource(e.detail.id)}
              @recording-edit=${(e: CustomEvent<{ id: string }>) => void this.editRecording(e.detail.id)}
              @recording-add=${() => this.addRecording()}
              @close=${() => (this.sourceOpen = false)}></mnx-studio-source>`
          : nothing}
        ${this.recordingsOpen && this.snapshot && this.doc ? keyed(this.addingRecording ? 'new' : this.editingRecordingId, html`<mnx-studio-recordings slot="side" .syncWarning=${!this.addingRecording && this.recordingWarning?.id === this.editingRecordingId ? this.recordingWarning.message : ''} .recordingId=${this.addingRecording ? null : this.editingRecordingId} .client=${this.client} .snapshot=${this.snapshot} .document=${this.doc}
          @recordings-changed=${async (e: CustomEvent<LibrarySnapshot>) => { this.player?.pause(); if (this.snapshot?.piece.canonical_rendition_id !== e.detail.piece.canonical_rendition_id) { await this.load(); return; } this.snapshot = { ...e.detail, tags: this.snapshot?.tags ?? [] }; this.setRecordings(e.detail); }}
          @recording-saved=${async (e: CustomEvent<{ id: string }>) => { if (!this.snapshot?.recordings.some(r => r.id === e.detail.id)) return; this.addingRecording = false; this.editingRecordingId = e.detail.id; this.selectedRecordingId = e.detail.id; await this.updateComplete; await this.player?.updateComplete; await this.player?.selectSource(e.detail.id); }}
          @recording-deleted=${() => {
            // Back to the list; playback falls back to Synth only when the deleted recording was playing.
            const wasPlaying = this.editingRecordingId !== null && this.editingRecordingId === this.selectedRecordingId;
            this.addingRecording = false; this.editingRecordingId = null; this.openPanel('source');
            if (wasPlaying) { this.selectedRecordingId = null; void this.player?.selectSource('synth'); }
          }}
          @back=${() => this.openPanel('source')}
          @close=${() => (this.recordingsOpen = false)}></mnx-studio-recordings>`) : nothing}
        ${this.instrumentsOpen && this.doc
          ? html`<mnx-studio-instruments slot="side"
              .parts=${this.instrumentParts(this.doc)}
              .hiddenParts=${this.hiddenParts}
              .mix=${this.partMix}
              .mixAvailable=${!this.playbackKind || this.playbackKind === 'synth'}
              .sourceName=${this.recordings.find(r => r.id === this.player?.sourceId)?.name ?? ''}
              @hidden-change=${(e: CustomEvent<number[]>) => this.setParts(e.detail, this.partMix)}
              @mix-change=${(e: CustomEvent<PartMix>) => this.setParts(this.hiddenParts, e.detail)}
              @close=${() => (this.instrumentsOpen = false)}></mnx-studio-instruments>`
          : nothing}
      </mnx-score-frame>
      ${this.tagsOpen ? html`<mnx-studio-tags .client=${this.client} .snapshot=${this.snapshot}
        @tags-changed=${(e: CustomEvent<TagsSnapshot>) => { if (this.snapshot) this.snapshot = { ...this.snapshot, ...e.detail, piece: { ...this.snapshot.piece, ...e.detail.piece } }; void this.refreshSnapshot(); }}
        @aliases-changed=${() => this.refreshSnapshot()}
        @close=${() => (this.tagsOpen = false)}></mnx-studio-tags>` : nothing}
    `;
  }
}
